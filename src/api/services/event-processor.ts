/**
 * Event Processing Pipeline
 * 
 * Normalizes, deduplicates, and enriches incoming LifeEvents before storage.
 */

import {
  SourceType,
  SensitivityLevel,
} from '../../types/life-event.js';
import type { 
  LifeEvent, 
  EventType,
  NotificationEventData,
  CalendarEventData,
  LocationEventData,
  ActivityEventData,
  PlaceTransitionData,
} from '../../types/life-event.js';

/**
 * Deduplication window (milliseconds)
 */
const DEDUP_WINDOW_MS = 60000; // 1 minute

/**
 * Recent events cache for deduplication
 */
interface DeduplicationEntry {
  event: LifeEvent;
  timestamp: number;
}

const recentEvents = new Map<string, DeduplicationEntry[]>();

/**
 * Event Normalizer
 * Ensures all events conform to expected structure
 */
export class EventNormalizer {
  /**
   * Normalize a LifeEvent
   */
  static normalize(event: LifeEvent): LifeEvent {
    // Ensure required fields
    if (!event.eventId) {
      throw new Error('Event missing eventId');
    }
    if (!event.userId) {
      throw new Error('Event missing userId');
    }
    if (!event.type) {
      throw new Error('Event missing type');
    }
    if (!event.timestamp) {
      throw new Error('Event missing timestamp');
    }

    // Normalize timestamp to ISO 8601
    event.timestamp = new Date(event.timestamp).toISOString();

    // Ensure source exists
    if (!event.source) {
      event.source = {
        type: SourceType.ANDROID,
        collector: 'unknown',
      };
    }

    // Ensure privacy metadata exists
    if (!event.privacy) {
      event.privacy = {
        sensitivity: SensitivityLevel.PRIVATE,
      };
    }

    // Type-specific normalization
    switch (event.type) {
      case 'NOTIFICATION':
        event.data = this.normalizeNotification(event.data as NotificationEventData);
        break;
      case 'CALENDAR_EVENT':
        event.data = this.normalizeCalendar(event.data as CalendarEventData);
        break;
      case 'LOCATION_UPDATE':
        event.data = this.normalizeLocation(event.data as LocationEventData);
        break;
      case 'ACTIVITY_CHANGE':
        event.data = this.normalizeActivity(event.data as ActivityEventData);
        break;
      case 'PLACE_TRANSITION':
        event.data = this.normalizePlaceTransition(event.data as PlaceTransitionData);
        break;
    }

    return event;
  }

  private static normalizeNotification(data: NotificationEventData): NotificationEventData {
    if (!data.package) {
      throw new Error('Notification missing package');
    }
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    return data;
  }

  private static normalizeCalendar(data: CalendarEventData): CalendarEventData {
    if (!data.title) {
      throw new Error('Calendar event missing title');
    }
    if (!data.startTime) {
      throw new Error('Calendar event missing startTime');
    }
    if (!data.endTime) {
      throw new Error('Calendar event missing endTime');
    }

    // Normalize times to ISO 8601
    data.startTime = new Date(data.startTime).toISOString();
    data.endTime = new Date(data.endTime).toISOString();

    return data;
  }

  private static normalizeLocation(data: LocationEventData): LocationEventData {
    if (data.latitude === undefined || data.longitude === undefined) {
      throw new Error('Location missing coordinates');
    }

    // Validate coordinates
    if (data.latitude < -90 || data.latitude > 90) {
      throw new Error('Invalid latitude');
    }
    if (data.longitude < -180 || data.longitude > 180) {
      throw new Error('Invalid longitude');
    }

    // Round to reasonable precision (6 decimals = ~10cm)
    data.latitude = Math.round(data.latitude * 1000000) / 1000000;
    data.longitude = Math.round(data.longitude * 1000000) / 1000000;

    return data;
  }

  private static normalizeActivity(data: ActivityEventData): ActivityEventData {
    if (!data.activity) {
      throw new Error('Activity event missing activity type');
    }
    if (data.confidence === undefined) {
      data.confidence = 1.0;
    }

    // Ensure confidence is in range [0, 1]
    data.confidence = Math.max(0, Math.min(1, data.confidence));

    return data;
  }

  private static normalizePlaceTransition(data: PlaceTransitionData): PlaceTransitionData {
    if (!data.transition) {
      throw new Error('Place transition missing transition type');
    }
    if (!data.to && !data.from) {
      throw new Error('Place transition missing destination');
    }
    return data;
  }
}

/**
 * Event Deduplicator
 * Detects and merges duplicate events
 */
export class EventDeduplicator {
  /**
   * Check if an event is a duplicate
   * Returns the original event ID if duplicate, null otherwise
   */
  static isDuplicate(event: LifeEvent): string | null {
    const key = this.getDeduplicationKey(event);
    const recent = recentEvents.get(key) || [];

    const now = Date.now();
    const eventTime = new Date(event.timestamp).getTime();

    // Find matching events within deduplication window
    for (const entry of recent) {
      const timeDiff = Math.abs(eventTime - entry.timestamp);
      
      if (timeDiff <= DEDUP_WINDOW_MS) {
        // Check if events are similar enough to be considered duplicates
        if (this.areSimilar(event, entry.event)) {
          console.log(`🔄 Duplicate detected: ${event.type} within ${timeDiff}ms`);
          return entry.event.eventId;
        }
      }
    }

    // Add to recent events cache
    recent.push({ event, timestamp: eventTime });
    
    // Clean up old entries (older than dedup window)
    const filtered = recent.filter(e => (now - e.timestamp) <= DEDUP_WINDOW_MS);
    recentEvents.set(key, filtered);

    return null;
  }

  /**
   * Generate deduplication key
   */
  private static getDeduplicationKey(event: LifeEvent): string {
    return `${event.userId}:${event.type}:${event.source.collector}`;
  }

  /**
   * Check if two events are similar enough to be duplicates
   */
  private static areSimilar(event1: LifeEvent, event2: LifeEvent): boolean {
    // Must be same type
    if (event1.type !== event2.type) {
      return false;
    }

    // Must be same user
    if (event1.userId !== event2.userId) {
      return false;
    }

    // Type-specific similarity checks
    switch (event1.type) {
      case 'NOTIFICATION':
        return this.areNotificationsSimilar(
          event1.data as NotificationEventData,
          event2.data as NotificationEventData
        );
      
      case 'CALENDAR_EVENT':
        return this.areCalendarEventsSimilar(
          event1.data as CalendarEventData,
          event2.data as CalendarEventData
        );
      
      case 'LOCATION_UPDATE':
        return this.areLocationsSimilar(
          event1.data as LocationEventData,
          event2.data as LocationEventData
        );
      
      case 'ACTIVITY_CHANGE':
        return this.areActivitiesSimilar(
          event1.data as ActivityEventData,
          event2.data as ActivityEventData
        );
      
      default:
        return false;
    }
  }

  private static areNotificationsSimilar(
    data1: NotificationEventData,
    data2: NotificationEventData
  ): boolean {
    return (
      data1.package === data2.package &&
      data1.title === data2.title &&
      data1.text === data2.text
    );
  }

  private static areCalendarEventsSimilar(
    data1: CalendarEventData,
    data2: CalendarEventData
  ): boolean {
    return (
      data1.title === data2.title &&
      data1.startTime === data2.startTime &&
      data1.location === data2.location
    );
  }

  private static areLocationsSimilar(
    data1: LocationEventData,
    data2: LocationEventData
  ): boolean {
    // Consider locations similar if within ~50 meters
    const latDiff = Math.abs(data1.latitude - data2.latitude);
    const lonDiff = Math.abs(data1.longitude - data2.longitude);
    
    return latDiff < 0.0005 && lonDiff < 0.0005;
  }

  private static areActivitiesSimilar(
    data1: ActivityEventData,
    data2: ActivityEventData
  ): boolean {
    return data1.activity === data2.activity;
  }
}

/**
 * Event Enricher
 * Adds derived metadata and context to events
 */
export class EventEnricher {
  /**
   * Enrich an event with additional context
   */
  static enrich(event: LifeEvent): LifeEvent {
    // Add metadata if not exists
    if (!event.metadata) {
      event.metadata = {};
    }

    // Type-specific enrichment
    switch (event.type) {
      case 'NOTIFICATION':
        this.enrichNotification(event);
        break;
      case 'CALENDAR_EVENT':
        this.enrichCalendar(event);
        break;
      case 'LOCATION_UPDATE':
        this.enrichLocation(event);
        break;
      case 'ACTIVITY_CHANGE':
        this.enrichActivity(event);
        break;
    }

    // Add processing timestamp
    event.processedAt = new Date().toISOString();

    return event;
  }

  private static enrichNotification(event: LifeEvent): void {
    const data = event.data as NotificationEventData;
    
    // Classify notification category
    const package_name = data.package.toLowerCase();
    
    if (package_name.includes('whatsapp') || package_name.includes('telegram')) {
      event.metadata!.category = 'MESSAGING';
      event.privacy.sensitivity = SensitivityLevel.SENSITIVE;
    } else if (package_name.includes('gmail') || package_name.includes('email')) {
      event.metadata!.category = 'EMAIL';
      event.privacy.sensitivity = SensitivityLevel.PRIVATE;
    } else if (package_name.includes('calendar')) {
      event.metadata!.category = 'CALENDAR';
      event.privacy.sensitivity = SensitivityLevel.PRIVATE;
    } else if (package_name.includes('bank') || package_name.includes('payment')) {
      event.metadata!.category = 'FINANCIAL';
      event.privacy.sensitivity = SensitivityLevel.SENSITIVE;
    } else {
      event.metadata!.category = 'OTHER';
    }

    // Check for OTP
    if (data.text && /\b\d{4,6}\b/.test(data.text)) {
      event.metadata!.containsOTP = true;
      event.privacy.sensitivity = SensitivityLevel.CRITICAL;
      event.privacy.localOnly = true;
    }
  }

  private static enrichCalendar(event: LifeEvent): void {
    const data = event.data as CalendarEventData;
    
    // Calculate duration
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    const durationMs = end.getTime() - start.getTime();
    event.metadata!.durationMinutes = Math.round(durationMs / 60000);

    // Determine if event is upcoming
    const now = new Date();
    event.metadata!.isUpcoming = start > now;
    event.metadata!.minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);

    // Check if event is today
    event.metadata!.isToday = 
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
  }

  private static enrichLocation(event: LifeEvent): void {
    const data = event.data as LocationEventData;
    
    // Add accuracy category
    if (data.accuracy) {
      if (data.accuracy < 50) {
        event.metadata!.accuracyLevel = 'HIGH';
      } else if (data.accuracy < 200) {
        event.metadata!.accuracyLevel = 'MEDIUM';
      } else {
        event.metadata!.accuracyLevel = 'LOW';
      }
    }

    // Detect if moving
    if (data.speed !== undefined) {
      event.metadata!.isMoving = data.speed > 0.5; // > 0.5 m/s
    }
  }

  private static enrichActivity(event: LifeEvent): void {
    const data = event.data as ActivityEventData;
    
    // Categorize activity
    const activity = data.activity;
    if (activity === 'STILL') {
      event.metadata!.activityCategory = 'STATIONARY';
    } else if (activity === 'WALKING' || activity === 'RUNNING') {
      event.metadata!.activityCategory = 'ON_FOOT';
    } else if (activity === 'DRIVING' || activity === 'IN_VEHICLE') {
      event.metadata!.activityCategory = 'IN_VEHICLE';
    } else if (activity === 'CYCLING') {
      event.metadata!.activityCategory = 'CYCLING';
    } else {
      event.metadata!.activityCategory = 'UNKNOWN';
    }

    // Assess confidence level
    if (data.confidence > 0.8) {
      event.metadata!.confidenceLevel = 'HIGH';
    } else if (data.confidence > 0.5) {
      event.metadata!.confidenceLevel = 'MEDIUM';
    } else {
      event.metadata!.confidenceLevel = 'LOW';
    }
  }
}

/**
 * Complete Event Processing Pipeline
 */
export class EventProcessor {
  /**
   * Process an incoming event through the full pipeline
   */
  static process(event: LifeEvent): { 
    event: LifeEvent; 
    isDuplicate: boolean; 
    duplicateOf?: string;
  } {
    try {
      // Step 1: Normalize
      const normalized = EventNormalizer.normalize(event);

      // Step 2: Check for duplicates
      const duplicateOf = EventDeduplicator.isDuplicate(normalized);
      if (duplicateOf) {
        return {
          event: normalized,
          isDuplicate: true,
          duplicateOf,
        };
      }

      // Step 3: Enrich
      const enriched = EventEnricher.enrich(normalized);

      return {
        event: enriched,
        isDuplicate: false,
      };

    } catch (error: any) {
      console.error('Event processing error:', error);
      throw error;
    }
  }

  /**
   * Process a batch of events
   */
  static processBatch(events: LifeEvent[]): {
    processed: LifeEvent[];
    duplicates: Array<{ eventId: string; duplicateOf: string }>;
    errors: Array<{ index: number; error: string }>;
  } {
    const processed: LifeEvent[] = [];
    const duplicates: Array<{ eventId: string; duplicateOf: string }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < events.length; i++) {
      try {
        const result = this.process(events[i]);
        
        if (result.isDuplicate && result.duplicateOf) {
          duplicates.push({
            eventId: result.event.eventId,
            duplicateOf: result.duplicateOf,
          });
        } else {
          processed.push(result.event);
        }

      } catch (error: any) {
        errors.push({
          index: i,
          error: error.message,
        });
      }
    }

    return { processed, duplicates, errors };
  }
}
