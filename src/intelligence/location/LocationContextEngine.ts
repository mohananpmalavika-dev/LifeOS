/**
 * Location Context Engine
 * 
 * The main orchestrator for Location Intelligence.
 * Coordinates all engines to produce comprehensive LocationContext.
 */

import {
  LocationContext,
  LocationEvent,
  LocationEventType,
  GeoPosition,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
  MovementIntent,
  PlaceType,
} from './types';
import { LocationCollector } from './collectors/LocationCollector';
import { ActivityCollector } from './collectors/ActivityCollector';
import { PlaceEngine } from './engines/PlaceEngine';
import { MovementEngine } from './engines/MovementEngine';
import { LocationStateMachine } from './engines/LocationStateMachine';
import { RoutineEngine } from './engines/RoutineEngine';
import { DestinationEngine, CalendarDestination } from './engines/DestinationEngine';
import { LocationPolicyEngine } from './LocationPolicyEngine';

export interface LocationContextEngineOptions {
  config?: Partial<LocationConfig>;
  onContextUpdate?: (context: LocationContext) => void;
  onLocationEvent?: (event: LocationEvent) => void;
}

export class LocationContextEngine {
  private config: LocationConfig;
  
  // Collectors
  private locationCollector: LocationCollector;
  private activityCollector: ActivityCollector;
  
  // Engines
  private placeEngine: PlaceEngine;
  private movementEngine: MovementEngine;
  private stateMachine: LocationStateMachine;
  private routineEngine: RoutineEngine;
  private destinationEngine: DestinationEngine;
  private policyEngine: LocationPolicyEngine;
  
  // State
  private currentContext?: LocationContext;
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  
  // Callbacks
  private onContextUpdate?: (context: LocationContext) => void;
  private onLocationEvent?: (event: LocationEvent) => void;
  
  constructor(options: LocationContextEngineOptions = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...options.config };
    
    // Initialize collectors
    this.locationCollector = new LocationCollector({
      accuracyMeters: 50,
      timeoutMs: 10000,
      maximumAge: 5000,
    });
    
    this.activityCollector = new ActivityCollector();
    
    // Initialize engines
    this.placeEngine = new PlaceEngine(this.config);
    this.movementEngine = new MovementEngine();
    this.stateMachine = new LocationStateMachine(this.config);
    this.routineEngine = new RoutineEngine(this.config);
    this.destinationEngine = new DestinationEngine(this.config);
    this.policyEngine = new LocationPolicyEngine(this.config);
    
    // Set callbacks
    this.onContextUpdate = options.onContextUpdate;
    this.onLocationEvent = options.onLocationEvent;
    
    // Listen to state machine transitions
    this.stateMachine.addListener((transition) => {
      this.handleStateTransition(transition);
    });
  }
  
  /**
   * Start location intelligence
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    
    // Initial update
    await this.updateContext();
    
    // Set up periodic updates based on policy
    const policy = this.policyEngine.getCurrentPolicy();
    this.updateInterval = setInterval(
      () => this.updateContext(),
      policy.intervalSeconds * 1000
    );
  }
  
  /**
   * Stop location intelligence
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }
  
  /**
   * Main context update loop
   */
  private async updateContext(): Promise<void> {
    try {
      // Get current position
      const position = await this.locationCollector.getCurrentPosition();
      if (!position) {
        return;
      }
      
      // Get activity signal
      const activitySignal = await this.activityCollector.getSignal();
      
      // Identify current place
      const currentPlace = await this.placeEngine.identifyPlace(position);
      
      // Analyze movement
      const movementAnalysis = this.movementEngine.analyzeMovement(
        position,
        activitySignal || undefined
      );
      
      // Update state machine
      const transition = this.stateMachine.processReading(
        position,
        currentPlace,
        this.currentContext?.previousPlace || null,
        movementAnalysis.movementState.state,
        movementAnalysis.isMoving
      );
      
      // Predict routine
      const routinePrediction = this.routineEngine.predictRoutine(
        currentPlace?.placeId,
        new Date()
      );
      
      // Predict destination
      const calendarEvents = await this.getUpcomingCalendarEvents();
      const destinationCandidates = this.destinationEngine.predictDestination(
        position,
        currentPlace?.placeId,
        calendarEvents,
        routinePrediction?.pattern || null,
        this.placeEngine.getAllPlaces()
      );
      
      const destination = destinationCandidates[0]?.place;
      
      // Check if approaching destination
      if (destination && this.destinationEngine.isApproachingDestination(position, destination)) {
        if (this.stateMachine.getCurrentState() !== 'APPROACHING_DESTINATION') {
          this.stateMachine.setState(
            'APPROACHING_DESTINATION',
            'Approaching predicted destination',
            destinationCandidates[0].probability
          );
        }
      }
      
      // Calculate dwell time
      const dwellTime = this.calculateDwellTime(currentPlace?.placeId);
      
      // Infer movement intent
      const movementIntent = this.inferMovementIntent(
        currentPlace,
        destination,
        routinePrediction?.pattern.type
      );
      
      // Build context
      const context: LocationContext = {
        timestamp: new Date(),
        currentPlace: currentPlace || undefined,
        previousPlace: this.currentContext?.currentPlace,
        destination,
        travelMode: movementAnalysis.travelMode,
        movementState: movementAnalysis.movementState,
        locationState: this.stateMachine.getCurrentState(),
        dwellTime,
        arrivalProbability: this.stateMachine.calculateArrivalProbability(
          position,
          destination,
          movementAnalysis.isMoving
        ),
        departureProbability: this.stateMachine.calculateDepartureProbability(
          position,
          currentPlace || undefined,
          movementAnalysis.isMoving
        ),
        routinePattern: routinePrediction?.pattern,
        movementIntent,
        confidence: this.calculateOverallConfidence(
          currentPlace,
          movementAnalysis,
          destinationCandidates
        ),
      };
      
      // Update current context
      this.currentContext = context;
      
      // Notify listeners
      if (this.onContextUpdate) {
        this.onContextUpdate(context);
      }
      
      // Update policy based on context
      this.policyEngine.updatePolicy(context);
      
    } catch (error) {
      console.error('Error updating location context:', error);
    }
  }
  
  /**
   * Handle state machine transitions
   */
  private handleStateTransition(transition: any): void {
    // Generate location events from state transitions
    let eventType: LocationEventType | null = null;
    
    switch (transition.toState) {
      case 'DEPARTED':
        eventType = LocationEventType.PLACE_DEPARTURE;
        break;
      case 'ARRIVED':
        eventType = LocationEventType.PLACE_ARRIVAL;
        break;
      case 'DWELLING':
        eventType = LocationEventType.PLACE_DWELL;
        break;
      case 'TRAVELING':
        if (transition.fromState === 'DEPARTED') {
          eventType = LocationEventType.TRAVEL_STARTED;
        }
        break;
      case 'APPROACHING_DESTINATION':
        eventType = LocationEventType.APPROACHING_DESTINATION;
        break;
    }
    
    if (eventType && this.onLocationEvent) {
      const event: LocationEvent = {
        type: eventType,
        timestamp: transition.timestamp,
        data: {
          fromState: transition.fromState,
          toState: transition.toState,
          reason: transition.reason,
          currentPlace: this.currentContext?.currentPlace,
          destination: this.currentContext?.destination,
        },
        confidence: transition.confidence,
      };
      
      this.onLocationEvent(event);
    }
  }
  
  /**
   * Calculate dwell time at current place
   */
  private calculateDwellTime(currentPlaceId?: string): number | undefined {
    if (!currentPlaceId || !this.currentContext) {
      return undefined;
    }
    
    // If we just arrived at a different place, reset
    if (this.currentContext.currentPlace?.placeId !== currentPlaceId) {
      return 0;
    }
    
    // Calculate time since arrival
    const timeInState = this.stateMachine.getTimeInState();
    return Math.floor(timeInState / 60); // Convert to minutes
  }
  
  /**
   * Infer movement intent
   */
  private inferMovementIntent(
    currentPlace: any,
    destination: any,
    routineType?: string
  ): MovementIntent | undefined {
    // If stationary, no intent
    if (!destination) {
      return undefined;
    }
    
    // Based on routine type
    if (routineType === 'WORKDAY_COMMUTE') {
      if (destination.type === PlaceType.WORK) {
        return MovementIntent.COMMUTING_TO_WORK;
      } else if (destination.type === PlaceType.HOME) {
        return MovementIntent.GOING_HOME;
      }
    }
    
    // Based on destination type
    switch (destination.type) {
      case PlaceType.HOME:
        return MovementIntent.GOING_HOME;
      case PlaceType.WORK:
        return MovementIntent.COMMUTING_TO_WORK;
      case PlaceType.GYM:
        return MovementIntent.EXERCISING;
      case PlaceType.HOSPITAL:
        return MovementIntent.GOING_TO_APPOINTMENT;
      case PlaceType.SHOP:
      case PlaceType.RESTAURANT:
        return MovementIntent.SHOPPING;
      default:
        return MovementIntent.UNKNOWN;
    }
  }
  
  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    currentPlace: any,
    movementAnalysis: any,
    destinationCandidates: any[]
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Place confidence
    if (currentPlace) {
      confidence = Math.max(confidence, currentPlace.confidence * 0.8);
    }
    
    // Movement confidence
    confidence = (confidence + movementAnalysis.movementState.confidence) / 2;
    
    // Destination confidence
    if (destinationCandidates.length > 0) {
      confidence = (confidence + destinationCandidates[0].probability) / 2;
    }
    
    return confidence;
  }
  
  /**
   * Get upcoming calendar events
   * (This would integrate with calendar system)
   */
  private async getUpcomingCalendarEvents(): Promise<CalendarDestination[]> {
    // TODO: Integrate with actual calendar system
    // For now, return empty array
    return [];
  }
  
  /**
   * Get current context
   */
  getCurrentContext(): LocationContext | undefined {
    return this.currentContext;
  }
  
  /**
   * Record manual place arrival (for training)
   */
  async recordPlaceVisit(
    placeId: string,
    arrivalTime: Date,
    departureTime?: Date
  ): Promise<void> {
    if (departureTime) {
      const durationMinutes = (departureTime.getTime() - arrivalTime.getTime()) / (60 * 1000);
      this.placeEngine.recordVisit(placeId, departureTime, durationMinutes);
    }
  }
  
  /**
   * Set place name
   */
  setPlaceName(placeId: string, name: string): void {
    this.placeEngine.setPlaceName(placeId, name);
  }
  
  /**
   * Set place type
   */
  setPlaceType(placeId: string, type: PlaceType): void {
    this.placeEngine.setPlaceType(placeId, type);
  }
  
  /**
   * Get all places
   */
  getAllPlaces() {
    return this.placeEngine.getAllPlaces();
  }
  
  /**
   * Get all routines
   */
  getAllRoutines() {
    return this.routineEngine.getAllRoutines();
  }
  
  /**
   * Get place engine
   */
  getPlaceEngine(): PlaceEngine {
    return this.placeEngine;
  }
  
  /**
   * Get routine engine
   */
  getRoutineEngine(): RoutineEngine {
    return this.routineEngine;
  }
}
