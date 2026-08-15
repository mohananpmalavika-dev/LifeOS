/**
 * Location State Machine
 * 
 * Manages location state transitions with hysteresis to prevent GPS bouncing.
 * Tracks: stationary → departure → traveling → approaching → arrival → dwelling
 */

import {
  LocationState,
  PlaceContext,
  MovementType,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
  GeoPosition,
} from '../types.js';
import { LocationCollector } from '../collectors/LocationCollector.js';

export interface StateTransition {
  fromState: LocationState;
  toState: LocationState;
  timestamp: Date;
  reason: string;
  confidence: number;
}

export interface StateMachineContext {
  currentState: LocationState;
  currentPlace?: PlaceContext;
  stateEnteredAt: Date;
  stabilityTimer?: NodeJS.Timeout;
  lastPosition?: GeoPosition;
  consecutiveReadings: number;
}

export class LocationStateMachine {
  private config: LocationConfig;
  private context: StateMachineContext;
  private transitionHistory: StateTransition[] = [];
  private listeners: Array<(transition: StateTransition) => void> = [];
  
  constructor(config: Partial<LocationConfig> = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...config };
    this.context = {
      currentState: LocationState.UNKNOWN,
      stateEnteredAt: new Date(),
      consecutiveReadings: 0,
    };
  }
  
  /**
   * Process new location reading
   */
  processReading(
    position: GeoPosition,
    currentPlace: PlaceContext | null,
    previousPlace: PlaceContext | null,
    movementType: MovementType,
    isMoving: boolean
  ): StateTransition | null {
    const previousState = this.context.currentState;
    let newState = previousState;
    let reason = '';
    let confidence = 0.8;
    
    // State machine logic
    switch (this.context.currentState) {
      case LocationState.UNKNOWN:
        if (currentPlace && !isMoving) {
          newState = LocationState.STATIONARY_AT_PLACE;
          reason = 'Detected at known place and stationary';
        } else if (isMoving) {
          newState = LocationState.TRAVELING;
          reason = 'Movement detected';
        }
        break;
        
      case LocationState.STATIONARY_AT_PLACE:
        if (isMoving && this.isLeavingPlace(position, currentPlace)) {
          newState = LocationState.POSSIBLE_DEPARTURE;
          reason = 'Movement detected at place boundary';
          confidence = 0.7;
        }
        break;
        
      case LocationState.POSSIBLE_DEPARTURE:
        if (!isMoving) {
          // False alarm - still at place
          newState = LocationState.STATIONARY_AT_PLACE;
          reason = 'Movement stopped - false departure';
          confidence = 0.6;
        } else if (this.hasLeftPlace(position, this.context.currentPlace)) {
          // Confirmed departure
          newState = LocationState.DEPARTED;
          reason = 'Confirmed departure from place';
          confidence = 0.9;
        }
        break;
        
      case LocationState.DEPARTED:
        if (isMoving) {
          newState = LocationState.TRAVELING;
          reason = 'Continued movement after departure';
        }
        break;
        
      case LocationState.TRAVELING:
        if (!isMoving) {
          // Check if we've arrived at a place
          if (currentPlace) {
            newState = LocationState.POSSIBLE_ARRIVAL;
            reason = 'Stopped at known place';
            confidence = 0.7;
          }
        }
        // Check if approaching a destination (handled externally)
        break;
        
      case LocationState.APPROACHING_DESTINATION:
        if (!isMoving && currentPlace) {
          newState = LocationState.POSSIBLE_ARRIVAL;
          reason = 'Stopped at destination';
          confidence = 0.8;
        } else if (!isMoving) {
          newState = LocationState.ARRIVED;
          reason = 'Stopped near expected destination';
          confidence = 0.6;
        }
        break;
        
      case LocationState.POSSIBLE_ARRIVAL:
        if (isMoving) {
          // False alarm - passing through
          newState = LocationState.TRAVELING;
          reason = 'Resumed movement - passing through';
          confidence = 0.6;
        } else if (this.hasStabilized()) {
          // Confirmed arrival
          newState = LocationState.ARRIVED;
          reason = 'Confirmed arrival - stable position';
          confidence = 0.95;
        }
        break;
        
      case LocationState.ARRIVED:
        if (currentPlace) {
          newState = LocationState.DWELLING;
          reason = 'Extended stay at place';
        }
        break;
        
      case LocationState.DWELLING:
        if (isMoving && this.isLeavingPlace(position, currentPlace)) {
          newState = LocationState.POSSIBLE_DEPARTURE;
          reason = 'Movement detected during dwelling';
          confidence = 0.7;
        }
        break;
    }
    
    // Perform transition if state changed
    if (newState !== previousState) {
      return this.transition(newState, reason, confidence, position, currentPlace);
    }
    
    // Update context even if no transition
    this.context.lastPosition = position;
    this.context.consecutiveReadings++;
    
    return null;
  }
  
  /**
   * Manually set state (for destination approaching)
   */
  setState(
    state: LocationState,
    reason: string,
    confidence: number
  ): StateTransition {
    return this.transition(state, reason, confidence);
  }
  
  /**
   * Perform state transition
   */
  private transition(
    newState: LocationState,
    reason: string,
    confidence: number,
    position?: GeoPosition,
    place?: PlaceContext | null
  ): StateTransition {
    const transition: StateTransition = {
      fromState: this.context.currentState,
      toState: newState,
      timestamp: new Date(),
      reason,
      confidence,
    };
    
    // Update context
    this.context.currentState = newState;
    this.context.stateEnteredAt = new Date();
    this.context.consecutiveReadings = 0;
    
    if (position) {
      this.context.lastPosition = position;
    }
    if (place !== undefined) {
      this.context.currentPlace = place || undefined;
    }
    
    // Clear any pending stability timer
    if (this.context.stabilityTimer) {
      clearTimeout(this.context.stabilityTimer);
      this.context.stabilityTimer = undefined;
    }
    
    // Record transition
    this.transitionHistory.push(transition);
    if (this.transitionHistory.length > 50) {
      this.transitionHistory.shift();
    }
    
    // Notify listeners
    this.notifyListeners(transition);
    
    return transition;
  }
  
  /**
   * Check if leaving place boundary
   */
  private isLeavingPlace(position: GeoPosition, place?: PlaceContext | null): boolean {
    if (!place) return false;
    
    const distance = LocationCollector.calculateDistance(position, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    
    // Consider leaving if near the boundary (within 20%)
    const boundaryThreshold = 100; // meters (would use actual place radius in real implementation)
    return distance > boundaryThreshold * 0.8;
  }
  
  /**
   * Check if has left place completely
   */
  private hasLeftPlace(position: GeoPosition, place?: PlaceContext): boolean {
    if (!place) return true;
    
    const distance = LocationCollector.calculateDistance(position, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    
    // Consider left if outside boundary + buffer
    const boundaryThreshold = 100; // meters
    const buffer = 50; // meters
    return distance > boundaryThreshold + buffer;
  }
  
  /**
   * Check if position has stabilized (for arrival confirmation)
   */
  private hasStabilized(): boolean {
    const timeInState = Date.now() - this.context.stateEnteredAt.getTime();
    const stabilityThreshold = this.config.arrivalStabilitySeconds * 1000;
    
    return timeInState >= stabilityThreshold;
  }
  
  /**
   * Get current state
   */
  getCurrentState(): LocationState {
    return this.context.currentState;
  }
  
  /**
   * Get time in current state (seconds)
   */
  getTimeInState(): number {
    return (Date.now() - this.context.stateEnteredAt.getTime()) / 1000;
  }
  
  /**
   * Calculate arrival probability
   */
  calculateArrivalProbability(
    position: GeoPosition,
    destination?: PlaceContext,
    isMoving = false
  ): number {
    const state = this.context.currentState;
    
    // Base probability on state
    let probability = 0.0;
    
    switch (state) {
      case LocationState.APPROACHING_DESTINATION:
        probability = 0.7;
        break;
      case LocationState.POSSIBLE_ARRIVAL:
        probability = 0.8;
        break;
      case LocationState.ARRIVED:
      case LocationState.DWELLING:
        probability = 0.99;
        break;
      case LocationState.TRAVELING:
        probability = 0.1;
        break;
      default:
        probability = 0.0;
    }
    
    // Adjust based on destination proximity
    if (destination) {
      const distance = LocationCollector.calculateDistance(position, {
        latitude: destination.latitude,
        longitude: destination.longitude,
      });
      
      if (distance < 50) {
        probability = Math.max(probability, 0.9);
      } else if (distance < 100) {
        probability = Math.max(probability, 0.7);
      } else if (distance < 500) {
        probability = Math.max(probability, 0.4);
      }
    }
    
    // Reduce probability if still moving
    if (isMoving) {
      probability *= 0.5;
    }
    
    // Increase probability with time in state
    if (state === LocationState.POSSIBLE_ARRIVAL || state === LocationState.ARRIVED) {
      const timeBonus = Math.min(0.2, this.getTimeInState() / 600); // Max 0.2 bonus over 10 minutes
      probability = Math.min(0.99, probability + timeBonus);
    }
    
    return probability;
  }
  
  /**
   * Calculate departure probability
   */
  calculateDepartureProbability(
    position: GeoPosition,
    currentPlace?: PlaceContext,
    isMoving = false
  ): number {
    const state = this.context.currentState;
    
    // Base probability on state
    let probability = 0.0;
    
    switch (state) {
      case LocationState.POSSIBLE_DEPARTURE:
        probability = 0.7;
        break;
      case LocationState.DEPARTED:
      case LocationState.TRAVELING:
        probability = 0.99;
        break;
      case LocationState.STATIONARY_AT_PLACE:
      case LocationState.DWELLING:
        probability = 0.01;
        break;
      default:
        probability = 0.0;
    }
    
    // Adjust based on place proximity
    if (currentPlace) {
      const distance = LocationCollector.calculateDistance(position, {
        latitude: currentPlace.latitude,
        longitude: currentPlace.longitude,
      });
      
      if (distance > 200) {
        probability = Math.max(probability, 0.95);
      } else if (distance > 100) {
        probability = Math.max(probability, 0.7);
      }
    }
    
    // Increase probability if moving
    if (isMoving) {
      probability = Math.min(0.99, probability * 1.5);
    }
    
    return probability;
  }
  
  /**
   * Add state change listener
   */
  addListener(listener: (transition: StateTransition) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of transition
   */
  private notifyListeners(transition: StateTransition): void {
    this.listeners.forEach(listener => {
      try {
        listener(transition);
      } catch (error) {
        console.error('Error in state machine listener:', error);
      }
    });
  }
  
  /**
   * Get transition history
   */
  getTransitionHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }
  
  /**
   * Reset state machine
   */
  reset(): void {
    this.context = {
      currentState: LocationState.UNKNOWN,
      stateEnteredAt: new Date(),
      consecutiveReadings: 0,
    };
    this.transitionHistory = [];
  }
}
