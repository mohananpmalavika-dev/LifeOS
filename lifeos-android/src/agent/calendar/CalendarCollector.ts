/**
 * Calendar Collector
 * 
 * Monitors calendar events and detects upcoming appointments.
 * Provides future context (what the user has planned).
 */

import * as Calendar from 'expo-calendar';
import { BaseCollector, CollectorStatus } from '../BaseCollector';
import { EventFactory } from '../../core/EventFactory';
import { LifeEvent } from '../../core/LifeEvent';

export interface CalendarCollectorConfig {
  enabled: boolean;
  lookAheadHours?: number;        // How far ahead to look for events
  syncIntervalMinutes?: number;   // How often to check for updates
  includeAllDayEvents?: boolean;
}

export class CalendarCollector extends BaseCollector {
  private calendarConfig: CalendarCollectorConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncedEvents: Set<string> = new Set();

  constructor(config: CalendarCollectorConfig) {
    super({
      enabled: config.enabled,
      permissions: ['calendar'],
    });
    this.calendarConfig = {
      lookAheadHours: 48,           // Default: 2 days ahead
      syncIntervalMinutes: 30,      // Default: check every 30 minutes
      includeAllDayEvents: true,
      ...config,
    };
  }

  getName(): string {
    return 'CalendarCollector';
  }

  async checkPermissions(): Promise<boolean> {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }

  async start(): Promise<void> {
    try {
      this.status = CollectorStatus.STARTING;
      this.log('Starting calendar collector');

      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Calendar permissions not granted');
        }
      }

      // Initial sync
      await this.syncCalendar();

      // Schedule periodic sync
      const intervalMs = (this.calendarConfig.syncIntervalMinutes || 30) * 60 * 1000;
      this.syncInterval = setInterval(() => {
        this.syncCalendar();
      }, intervalMs);

      this.status = CollectorStatus.RUNNING;
      this.log('Calendar collector started');

    } catch (error: any) {
      this.status = CollectorStatus.ERROR;
      this.emitError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping calendar collector');

      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      this.status = CollectorStatus.STOPPED;
      this.log('Calendar collector stopped');

    } catch (error: any) {
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Sync calendar events
   */
  private async syncCalendar() {
    try {
      this.log('Syncing calendar events');

      // Get all calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      if (calendars.length === 0) {
        this.log('No calendars found');
        return;
      }

      // Define time range
      const now = new Date();
      const lookAhead = new Date(
        now.getTime() + (this.calendarConfig.lookAheadHours || 48) * 60 * 60 * 1000
      );

      // Get events from all calendars
      for (const calendar of calendars) {
        const events = await Calendar.getEventsAsync(
          [calendar.id],
          now,
          lookAhead
        );

        for (const event of events) {
          await this.processCalendarEvent(event, calendar);
        }
      }

      this.log(`Synced ${calendars.length} calendars`);

    } catch (error: any) {
      this.log('Error syncing calendar:', error);
      this.emitError(error);
    }
  }

  /**
   * Process a single calendar event
   */
  private async processCalendarEvent(
    event: Calendar.Event,
    calendar: Calendar.Calendar
  ) {
    try {
      // Skip if already processed
      if (this.lastSyncedEvents.has(event.id)) {
        return;
      }

      // Skip all-day events if configured
      if (event.allDay && !this.calendarConfig.includeAllDayEvents) {
        return;
      }

      // Create LifeEvent
      const lifeEvent = EventFactory.createCalendarEvent(
        event.title,
        new Date(event.startDate),
        new Date(event.endDate),
        event.location || undefined,
        event.notes || undefined,
        calendar.id
      );

      // Add additional metadata
      lifeEvent.metadata = {
        ...lifeEvent.metadata,
        calendarName: calendar.title,
        calendarColor: calendar.color,
        isRecurring: !!event.recurrenceRule,
        allDay: event.allDay,
        status: event.status,
      };

      // Calculate time until event
      const now = new Date();
      const startTime = new Date(event.startDate);
      const minutesUntil = (startTime.getTime() - now.getTime()) / (1000 * 60);

      lifeEvent.metadata.minutesUntil = Math.round(minutesUntil);
      lifeEvent.metadata.isUpcoming = minutesUntil > 0;
      lifeEvent.metadata.isSoon = minutesUntil > 0 && minutesUntil <= 60;

      // Mark as processed
      this.lastSyncedEvents.add(event.id);

      this.log(`Calendar event: "${event.title}" in ${Math.round(minutesUntil)} minutes`);
      this.emitEvent(lifeEvent);

    } catch (error: any) {
      this.log('Error processing calendar event:', error);
      this.emitError(error);
    }
  }

  /**
   * Get upcoming events (for UI display)
   */
  async getUpcomingEvents(hours: number = 24): Promise<Calendar.Event[]> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const allEvents: Calendar.Event[] = [];
      for (const calendar of calendars) {
        const events = await Calendar.getEventsAsync([calendar.id], now, end);
        allEvents.push(...events);
      }

      // Sort by start time
      allEvents.sort((a, b) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      return allEvents;

    } catch (error: any) {
      this.log('Error getting upcoming events:', error);
      return [];
    }
  }

  /**
   * Clear synced events cache
   */
  clearCache() {
    this.lastSyncedEvents.clear();
    this.log('Cache cleared');
  }
}
