/**
 * Notification Collector
 * 
 * Monitors Android notifications and converts them to LifeEvents.
 * Includes privacy filtering to prevent sensitive data leakage.
 */

import * as Notifications from 'expo-notifications';
import { BaseCollector, CollectorStatus } from '../BaseCollector';
import { EventFactory } from '../../core/EventFactory';
import { PrivacyFilter } from '../../local/PrivacyFilter';
import { LifeEvent } from '../../core/LifeEvent';

export interface NotificationCollectorConfig {
  enabled: boolean;
  filterSystemNotifications?: boolean;
  userPrivacySettings?: {
    shareMessaging?: boolean;
    shareEmail?: boolean;
    shareFinancial?: boolean;
  };
}

export class NotificationCollector extends BaseCollector {
  private notificationSubscription: any = null;
  private notificationConfig: NotificationCollectorConfig;

  constructor(config: NotificationCollectorConfig) {
    super({
      enabled: config.enabled,
      permissions: ['notifications'],
    });
    this.notificationConfig = config;
  }

  getName(): string {
    return 'NotificationCollector';
  }

  async checkPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async start(): Promise<void> {
    try {
      this.status = CollectorStatus.STARTING;
      this.log('Starting notification collector');

      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Notification permissions not granted');
        }
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Subscribe to notification events
      this.notificationSubscription = Notifications.addNotificationReceivedListener(
        this.handleNotification.bind(this)
      );

      this.status = CollectorStatus.RUNNING;
      this.log('Notification collector started');

    } catch (error: any) {
      this.status = CollectorStatus.ERROR;
      this.emitError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping notification collector');

      if (this.notificationSubscription) {
        this.notificationSubscription.remove();
        this.notificationSubscription = null;
      }

      this.status = CollectorStatus.STOPPED;
      this.log('Notification collector stopped');

    } catch (error: any) {
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Handle incoming notification
   */
  private async handleNotification(notification: Notifications.Notification) {
    try {
      const request = notification.request;
      const content = request.content;

      // Extract notification data
      const packageName = content.data?.package || 'unknown';
      const appName = content.data?.appName || packageName;
      const title = content.title || null;
      const body = content.body || null;

      // Filter system notifications if configured
      if (this.notificationConfig.filterSystemNotifications) {
        if (packageName.startsWith('android.') || packageName.startsWith('com.android.')) {
          this.log('Skipping system notification');
          return;
        }
      }

      // Apply privacy classification
      let classification = PrivacyFilter.classifyNotification(
        packageName,
        appName,
        title,
        body
      );

      // Apply user privacy preferences
      if (this.notificationConfig.userPrivacySettings) {
        classification = PrivacyFilter.applyUserPreferences(
          classification,
          this.notificationConfig.userPrivacySettings
        );
      }

      // Check if notification should be kept local only
      if (classification.localOnly) {
        this.log('Notification marked as local-only, not creating event');
        return;
      }

      // Redact sensitive content if needed
      const redacted = PrivacyFilter.redactNotification(title, body, classification);

      // Create event
      const event = EventFactory.createNotificationEvent(
        packageName,
        appName,
        redacted.title,
        redacted.text,
        classification.category,
        content.priority
      );

      // Update privacy metadata
      event.privacy.sensitivity = classification.sensitivity;
      event.privacy.redacted = classification.shouldRedact;
      
      // Add metadata
      event.metadata = {
        ...event.metadata,
        privacyCategory: classification.category,
        originalContentRedacted: classification.shouldRedact,
      };

      this.log(`Notification event created: ${appName} (${classification.category})`);
      this.emitEvent(event);

    } catch (error: any) {
      this.log('Error processing notification:', error);
      this.emitError(error);
    }
  }

  /**
   * Update privacy settings
   */
  updatePrivacySettings(settings: {
    shareMessaging?: boolean;
    shareEmail?: boolean;
    shareFinancial?: boolean;
  }) {
    this.notificationConfig.userPrivacySettings = {
      ...this.notificationConfig.userPrivacySettings,
      ...settings,
    };
    this.log('Privacy settings updated');
  }
}
