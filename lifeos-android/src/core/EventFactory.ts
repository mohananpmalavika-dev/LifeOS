/**
 * Event Factory
 * 
 * Creates properly formatted LifeEvents from collector data
 */

import { nanoid } from 'nanoid';
import * as Device from 'expo-device';
import {
  LifeEvent,
  EventType,
  SourceType,
  SensitivityLevel,
  EventSource,
  PrivacyMetadata,
} from './LifeEvent';

export class EventFactory {
  private static deviceId: string | null = null;
  private static userId: string | null = null;
  private static appVersion: string = '0.3.0';

  /**
   * Initialize factory with device and user info
   */
  static initialize(deviceId: string, userId: string) {
    this.deviceId = deviceId;
    this.userId = userId;
  }

  /**
   * Create a base LifeEvent structure
   */
  private static createBaseEvent(
    type: EventType,
    collectorName: string,
    data: any,
    privacy: Partial<PrivacyMetadata> = {}
  ): LifeEvent {
    if (!this.deviceId || !this.userId) {
      throw new Error('EventFactory not initialized. Call initialize() first.');
    }

    const source: EventSource = {
      type: SourceType.ANDROID,
      collector: collectorName,
      deviceId: this.deviceId,
      platform: `${Device.osName} ${Device.osVersion}`,
      appVersion: this.appVersion,
    };

    const privacyMetadata: PrivacyMetadata = {
      sensitivity: SensitivityLevel.PRIVATE,
      encrypted: false,
      ...privacy,
    };

    return {
      eventId: `evt_${nanoid(16)}`,
      userId: this.userId,
      deviceId: this.deviceId,
      type,
      timestamp: new Date().toISOString(),
      source,
      data,
      privacy: privacyMetadata,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create a notification event
   */
  static createNotificationEvent(
    packageName: string,
    appName: string,
    title: string | null,
    text: string | null,
    category?: string,
    priority?: number
  ): LifeEvent {
    return this.createBaseEvent(
      EventType.NOTIFICATION,
      'notification',
      {
        package: packageName,
        appName,
        title,
        text,
        category,
        priority,
        timestamp: new Date().toISOString(),
      },
      {
        sensitivity: SensitivityLevel.PRIVATE,
      }
    );
  }

  /**
   * Create a calendar event
   */
  static createCalendarEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    location?: string,
    description?: string,
    calendarId?: string
  ): LifeEvent {
    return this.createBaseEvent(
      EventType.CALENDAR_EVENT,
      'calendar',
      {
        title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location,
        description,
        calendarId,
        allDay: false,
      },
      {
        sensitivity: SensitivityLevel.PRIVATE,
      }
    );
  }

  /**
   * Create a location update event
   */
  static createLocationEvent(
    latitude: number,
    longitude: number,
    accuracy?: number,
    altitude?: number,
    speed?: number,
    heading?: number
  ): LifeEvent {
    return this.createBaseEvent(
      EventType.LOCATION_UPDATE,
      'location',
      {
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        provider: 'gps',
      },
      {
        sensitivity: SensitivityLevel.SENSITIVE,
      }
    );
  }

  /**
   * Create a place transition event
   */
  static createPlaceTransitionEvent(
    from: string | undefined,
    to: string,
    transition: 'ARRIVAL' | 'DEPARTURE',
    location: { latitude: number; longitude: number; accuracy?: number },
    confidence: number
  ): LifeEvent {
    return this.createBaseEvent(
      EventType.PLACE_TRANSITION,
      'location',
      {
        from,
        to,
        transition,
        location,
        confidence,
      },
      {
        sensitivity: SensitivityLevel.PRIVATE,
      }
    );
  }

  /**
   * Create an activity change event
   */
  static createActivityEvent(
    activity: string,
    confidence: number,
    previousActivity?: string
  ): LifeEvent {
    return this.createBaseEvent(
      EventType.ACTIVITY_CHANGE,
      'activity',
      {
        activity,
        confidence,
        previousActivity,
      },
      {
        sensitivity: SensitivityLevel.PUBLIC,
      }
    );
  }
}
