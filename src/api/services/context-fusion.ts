/**
 * Context Fusion Engine
 * 
 * Combines notification, calendar, location, and activity events to derive
 * meaningful life contexts like COMMUTING, AT_WORK, UPCOMING_MEETING, etc.
 * 
 * This is where the "Passive Agent" intelligence emerges - no single sensor
 * knows the full context, but fusion reveals the user's actual life situation.
 */

import type { 
  LifeEvent,
  EventType,
  CalendarEventData,
  LocationEventData,
  ActivityEventData,
  PlaceType,
  ActivityType,
} from '../../types/life-event.js';

/**
 * Life Context Types
 * High-level interpretations of what's happening in the user's life
 */
export enum LifeContextType {
  // Movement contexts
  COMMUTING = 'COMMUTING',
  TRAVELING_HOME = 'TRAVELING_HOME',
  TRAVELING_TO_MEETING = 'TRAVELING_TO_MEETING',
  
  // Location contexts
  AT_HOME = 'AT_HOME',
  AT_WORK = 'AT_WORK',
  AT_GYM = 'AT_GYM',
  SHOPPING = 'SHOPPING',
  
  // Activity contexts
  IN_MEETING = 'IN_MEETING',
  UPCOMING_MEETING = 'UPCOMING_MEETING',
  MEETING_SOON = 'MEETING_SOON',
  WORKING = 'WORKING',
  EXERCISING = 'EXERCISING',
  RESTING = 'RESTING',
  
  // Social contexts
  SOCIAL_ACTIVITY = 'SOCIAL_ACTIVITY',
  
  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * Fused Life Context
 * The result of combining multiple events
 */
export interface FusedContext {
  contextType: LifeContextType;
  confidence: number;           // 0.0 - 1.0
  startTime: string;
  endTime?: string;
  
  // Source events that contributed to this context
  sourceEvents: {
    notification?: LifeEvent[];
    calendar?: LifeEvent[];
    location?: LifeEvent[];
    activity?: LifeEvent[];
  };
  
  // Derived insights
  insights: {
    description: string;        // Human-readable context description
    key_signals: string[];      // What signals led to this interpretation
    confidence_factors: string[]; // What increased/decreased confidence
  };
  
  // Related entities
  entities?: {
    people?: string[];
    places?: string[];
    organizations?: string[];
  };
  
  // Actionable recommendations
  recommendations?: string[];
  
  metadata?: Record<string, any>;
}

/**
 * Event Window
 * Recent events grouped by type for analysis
 */
interface EventWindow {
  notification: LifeEvent[];
  calendar: LifeEvent[];
  location: LifeEvent[];
  activity: LifeEvent[];
  timeWindowMinutes: number;
}

/**
 * Context Fusion Engine
 */
export class ContextFusionEngine {
  /**
   * Analyze events and derive life context
   */
  static async fuseContext(
    events: LifeEvent[],
    timeWindowMinutes: number = 60
  ): Promise<FusedContext[]> {
    // Group events by type
    const window = this.createEventWindow(events, timeWindowMinutes);
    
    // Derive contexts
    const contexts: FusedContext[] = [];
    
    // Check for meeting-related contexts
    const meetingContext = this.detectMeetingContext(window);
    if (meetingContext) {
      contexts.push(meetingContext);
    }
    
    // Check for commuting context
    const commutingContext = this.detectCommutingContext(window);
    if (commutingContext) {
      contexts.push(commutingContext);
    }
    
    // Check for location-based contexts
    const locationContext = this.detectLocationContext(window);
    if (locationContext) {
      contexts.push(locationContext);
    }
    
    // Check for activity-based contexts
    const activityContext = this.detectActivityContext(window);
    if (activityContext) {
      contexts.push(activityContext);
    }
    
    // If no specific context detected, return unknown
    if (contexts.length === 0) {
      contexts.push(this.createUnknownContext(window));
    }
    
    return contexts;
  }
  
  /**
   * Create event window grouped by type
   */
  private static createEventWindow(
    events: LifeEvent[],
    timeWindowMinutes: number
  ): EventWindow {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMinutes * 60000);
    
    // Filter events within time window and sort by type
    const recentEvents = events.filter(e => 
      new Date(e.timestamp) >= windowStart
    );
    
    return {
      notification: recentEvents.filter(e => e.type === 'NOTIFICATION'),
      calendar: recentEvents.filter(e => 
        e.type === 'CALENDAR_EVENT' || e.type === 'CALENDAR_UPDATE'
      ),
      location: recentEvents.filter(e => 
        e.type === 'LOCATION_UPDATE' || e.type === 'PLACE_TRANSITION'
      ),
      activity: recentEvents.filter(e => e.type === 'ACTIVITY_CHANGE'),
      timeWindowMinutes,
    };
  }
  
  /**
   * Detect meeting-related contexts
   */
  private static detectMeetingContext(window: EventWindow): FusedContext | null {
    if (window.calendar.length === 0) {
      return null;
    }
    
    const now = new Date();
    const upcomingThresholdMinutes = 120; // Look ahead 2 hours
    const soonThresholdMinutes = 30;      // Meeting is "soon" if within 30 min
    
    // Find upcoming meetings
    const upcomingMeetings = window.calendar
      .map(e => e.data as CalendarEventData)
      .filter(data => {
        const startTime = new Date(data.startTime);
        const minutesUntil = (startTime.getTime() - now.getTime()) / 60000;
        return minutesUntil > 0 && minutesUntil <= upcomingThresholdMinutes;
      })
      .sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    
    if (upcomingMeetings.length === 0) {
      return null;
    }
    
    const nextMeeting = upcomingMeetings[0];
    const startTime = new Date(nextMeeting.startTime);
    const minutesUntil = (startTime.getTime() - now.getTime()) / 60000;
    
    // Check if user is moving toward meeting
    const isMoving = window.activity.some(e => {
      const data = e.data as ActivityEventData;
      return data.activity === 'DRIVING' || 
             data.activity === 'IN_VEHICLE' || 
             data.activity === 'WALKING';
    });
    
    // Determine context type
    let contextType: LifeContextType;
    let description: string;
    const keySignals: string[] = [];
    const confidenceFactors: string[] = [];
    let confidence = 0.7;
    
    if (minutesUntil <= soonThresholdMinutes) {
      contextType = LifeContextType.MEETING_SOON;
      description = `Meeting "${nextMeeting.title}" starts in ${Math.round(minutesUntil)} minutes`;
      keySignals.push(`Calendar event in ${Math.round(minutesUntil)} minutes`);
      confidence = 0.9;
    } else if (isMoving) {
      contextType = LifeContextType.TRAVELING_TO_MEETING;
      description = `Traveling to meeting "${nextMeeting.title}" (in ${Math.round(minutesUntil)} minutes)`;
      keySignals.push(`Calendar event in ${Math.round(minutesUntil)} minutes`);
      keySignals.push('User is currently moving');
      confidence = 0.85;
      confidenceFactors.push('Movement detected toward meeting time');
    } else {
      contextType = LifeContextType.UPCOMING_MEETING;
      description = `Meeting "${nextMeeting.title}" scheduled in ${Math.round(minutesUntil)} minutes`;
      keySignals.push(`Calendar event in ${Math.round(minutesUntil)} minutes`);
    }
    
    // Check for meeting location
    if (nextMeeting.location) {
      keySignals.push(`Location: ${nextMeeting.location}`);
      confidenceFactors.push('Meeting location specified');
    }
    
    // Check for related notifications
    const meetingNotifications = window.notification.filter(e => {
      const text = (e.data as any).text || '';
      const title = (e.data as any).title || '';
      return text.toLowerCase().includes('meeting') || 
             title.toLowerCase().includes(nextMeeting.title.toLowerCase());
    });
    
    if (meetingNotifications.length > 0) {
      keySignals.push(`${meetingNotifications.length} meeting notification(s)`);
      confidence += 0.1;
    }
    
    return {
      contextType,
      confidence: Math.min(confidence, 1.0),
      startTime: now.toISOString(),
      sourceEvents: {
        calendar: window.calendar,
        activity: window.activity,
        notification: meetingNotifications.length > 0 ? meetingNotifications : undefined,
      },
      insights: {
        description,
        key_signals: keySignals,
        confidence_factors: confidenceFactors,
      },
      recommendations: this.generateMeetingRecommendations(
        nextMeeting, 
        minutesUntil, 
        isMoving
      ),
      metadata: {
        meetingTitle: nextMeeting.title,
        meetingStartTime: nextMeeting.startTime,
        minutesUntil: Math.round(minutesUntil),
        meetingLocation: nextMeeting.location,
      },
    };
  }
  
  /**
   * Detect commuting context
   */
  private static detectCommutingContext(window: EventWindow): FusedContext | null {
    if (window.activity.length === 0) {
      return null;
    }
    
    // Check if user is in vehicle or walking for extended period
    const latestActivity = window.activity[window.activity.length - 1];
    const activityData = latestActivity.data as ActivityEventData;
    
    const commuteActivities: ActivityType[] = ['DRIVING', 'IN_VEHICLE', 'WALKING'];
    
    if (!commuteActivities.includes(activityData.activity)) {
      return null;
    }
    
    // Check if there's a destination (calendar event or typical commute time)
    const now = new Date();
    const hour = now.getHours();
    
    // Morning commute: 6-10am
    // Evening commute: 4-8pm
    const isMorningCommute = hour >= 6 && hour <= 10;
    const isEveningCommute = hour >= 16 && hour <= 20;
    
    if (!isMorningCommute && !isEveningCommute) {
      return null; // Not typical commute time
    }
    
    const contextType = isMorningCommute 
      ? LifeContextType.COMMUTING 
      : LifeContextType.TRAVELING_HOME;
    
    const description = isMorningCommute
      ? `Commuting (${activityData.activity.toLowerCase()})`
      : `Traveling home (${activityData.activity.toLowerCase()})`;
    
    const keySignals = [
      `Activity: ${activityData.activity}`,
      `Time of day: ${isMorningCommute ? 'morning' : 'evening'}`,
    ];
    
    let confidence = activityData.confidence * 0.7;
    const confidenceFactors: string[] = [];
    
    // Boost confidence if there's a calendar event
    if (window.calendar.length > 0 && isMorningCommute) {
      confidence += 0.2;
      confidenceFactors.push('Calendar event suggests destination');
    }
    
    return {
      contextType,
      confidence: Math.min(confidence, 1.0),
      startTime: latestActivity.timestamp,
      sourceEvents: {
        activity: window.activity,
        location: window.location,
        calendar: window.calendar.length > 0 ? window.calendar : undefined,
      },
      insights: {
        description,
        key_signals: keySignals,
        confidence_factors: confidenceFactors,
      },
      metadata: {
        activity: activityData.activity,
        activityConfidence: activityData.confidence,
        timeOfDay: isMorningCommute ? 'morning' : 'evening',
      },
    };
  }
  
  /**
   * Detect location-based contexts
   */
  private static detectLocationContext(window: EventWindow): FusedContext | null {
    if (window.location.length === 0) {
      return null;
    }
    
    // Check for place transitions
    const placeTransitions = window.location.filter(e => 
      e.type === 'PLACE_TRANSITION'
    );
    
    if (placeTransitions.length === 0) {
      return null;
    }
    
    const latestTransition = placeTransitions[placeTransitions.length - 1];
    const transitionData = latestTransition.data as any;
    
    // Map place to context
    const placeToContext: Record<string, LifeContextType> = {
      'HOME': LifeContextType.AT_HOME,
      'WORK': LifeContextType.AT_WORK,
      'GYM': LifeContextType.AT_GYM,
      'SHOP': LifeContextType.SHOPPING,
    };
    
    const place = transitionData.to || transitionData.from;
    const contextType = placeToContext[place] || LifeContextType.UNKNOWN;
    
    if (contextType === LifeContextType.UNKNOWN) {
      return null;
    }
    
    const description = `Currently at ${place.toLowerCase()}`;
    const keySignals = [`Place: ${place}`];
    
    // Check activity alignment
    const latestActivity = window.activity.length > 0 
      ? window.activity[window.activity.length - 1]
      : null;
    
    let confidence = transitionData.confidence || 0.7;
    
    if (latestActivity) {
      const activityData = latestActivity.data as ActivityEventData;
      if (activityData.activity === 'STILL') {
        confidence += 0.1;
        keySignals.push('User is stationary');
      }
    }
    
    return {
      contextType,
      confidence: Math.min(confidence, 1.0),
      startTime: latestTransition.timestamp,
      sourceEvents: {
        location: window.location,
        activity: latestActivity ? [latestActivity] : undefined,
      },
      insights: {
        description,
        key_signals: keySignals,
        confidence_factors: ['Place transition detected'],
      },
      metadata: {
        place,
        transition: transitionData.transition,
      },
    };
  }
  
  /**
   * Detect activity-based contexts
   */
  private static detectActivityContext(window: EventWindow): FusedContext | null {
    if (window.activity.length === 0) {
      return null;
    }
    
    const latestActivity = window.activity[window.activity.length - 1];
    const activityData = latestActivity.data as ActivityEventData;
    
    // Map activity to context
    let contextType: LifeContextType = LifeContextType.UNKNOWN;
    let description: string;
    
    switch (activityData.activity) {
      case 'STILL':
        contextType = LifeContextType.RESTING;
        description = 'Stationary/resting';
        break;
      case 'WALKING':
      case 'RUNNING':
        // Check if near gym or park
        contextType = LifeContextType.EXERCISING;
        description = 'Physical activity';
        break;
      case 'CYCLING':
        contextType = LifeContextType.EXERCISING;
        description = 'Cycling';
        break;
      default:
        return null;
    }
    
    return {
      contextType,
      confidence: activityData.confidence,
      startTime: latestActivity.timestamp,
      sourceEvents: {
        activity: window.activity,
      },
      insights: {
        description,
        key_signals: [`Activity: ${activityData.activity}`],
        confidence_factors: [`Activity confidence: ${activityData.confidence}`],
      },
      metadata: {
        activity: activityData.activity,
      },
    };
  }
  
  /**
   * Create unknown context fallback
   */
  private static createUnknownContext(window: EventWindow): FusedContext {
    const now = new Date();
    
    return {
      contextType: LifeContextType.UNKNOWN,
      confidence: 0.3,
      startTime: now.toISOString(),
      sourceEvents: {
        notification: window.notification,
        calendar: window.calendar,
        location: window.location,
        activity: window.activity,
      },
      insights: {
        description: 'Unable to determine specific context',
        key_signals: [
          `${window.notification.length} notifications`,
          `${window.calendar.length} calendar events`,
          `${window.location.length} location updates`,
          `${window.activity.length} activity changes`,
        ],
        confidence_factors: ['Insufficient data for context inference'],
      },
    };
  }
  
  /**
   * Generate meeting-specific recommendations
   */
  private static generateMeetingRecommendations(
    meeting: CalendarEventData,
    minutesUntil: number,
    isMoving: boolean
  ): string[] {
    const recommendations: string[] = [];
    
    // Time-based recommendations
    if (minutesUntil <= 5 && !isMoving) {
      recommendations.push('Meeting starts very soon - consider joining now');
    } else if (minutesUntil <= 15 && !isMoving) {
      recommendations.push('Meeting starts in 15 minutes - prepare to join');
    } else if (minutesUntil <= 30 && !isMoving && meeting.location) {
      recommendations.push('Consider leaving soon for your meeting');
    }
    
    // Location-based recommendations
    if (meeting.location && !isMoving && minutesUntil > 15) {
      recommendations.push(`Check traffic to ${meeting.location}`);
    }
    
    // Preparation recommendations
    if (minutesUntil <= 60 && minutesUntil > 30) {
      recommendations.push('Review meeting materials if needed');
    }
    
    return recommendations;
  }
  
  /**
   * Get current life context for a user
   */
  static async getCurrentContext(
    userId: string,
    recentEvents: LifeEvent[]
  ): Promise<FusedContext | null> {
    const contexts = await this.fuseContext(recentEvents, 60);
    
    // Return highest confidence context
    if (contexts.length === 0) {
      return null;
    }
    
    contexts.sort((a, b) => b.confidence - a.confidence);
    return contexts[0];
  }
}
