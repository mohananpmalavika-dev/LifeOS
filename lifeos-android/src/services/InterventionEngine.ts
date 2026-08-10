/**
 * Intervention Engine (Android Client)
 * 
 * Monitors contexts and generates passive interventions.
 * First intervention: Meeting departure reminder.
 */

import * as Notifications from 'expo-notifications';
import { ContextService, FusedContext } from './ContextService';

export interface Intervention {
  id: string;
  type: 'REMINDER' | 'SUGGESTION' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  context: FusedContext;
  timestamp: string;
  acknowledged: boolean;
}

export class InterventionEngine {
  private contextService: ContextService;
  private interventions: Intervention[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCheckedContext: string | null = null;

  constructor(contextService: ContextService) {
    this.contextService = contextService;
  }

  /**
   * Start monitoring for interventions
   */
  start() {
    console.log('[InterventionEngine] Starting intervention monitoring');

    // Check every 2 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkForInterventions();
    }, 120000);

    // Initial check
    this.checkForInterventions();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[InterventionEngine] Stopped intervention monitoring');
  }

  /**
   * Check if any interventions are needed
   */
  private async checkForInterventions() {
    try {
      const context = await this.contextService.getCurrentContext();

      if (!context) {
        return;
      }

      // Skip if we've already processed this context
      const contextKey = `${context.contextType}_${context.startTime}`;
      if (contextKey === this.lastCheckedContext) {
        return;
      }
      this.lastCheckedContext = contextKey;

      console.log('[InterventionEngine] Checking context:', context.contextType);

      // Check for meeting departure intervention
      if (context.contextType === 'UPCOMING_MEETING' || context.contextType === 'MEETING_SOON') {
        await this.checkMeetingDepartureIntervention(context);
      }

      // Check for commuting intervention
      if (context.contextType === 'COMMUTING') {
        await this.checkCommutingIntervention(context);
      }

      // Check for recommendations from context
      if (context.recommendations && context.recommendations.length > 0) {
        await this.processContextRecommendations(context);
      }

    } catch (error) {
      console.error('[InterventionEngine] Error checking interventions:', error);
    }
  }

  /**
   * Meeting Departure Intervention
   * 
   * THE KEY PASSIVE AGENT FEATURE:
   * Reminds user to leave for meeting based on:
   * - Meeting start time
   * - Current location
   * - Typical travel time
   * - Current activity (still vs moving)
   */
  private async checkMeetingDepartureIntervention(context: FusedContext) {
    try {
      const metadata = context.metadata || {};
      const minutesUntil = metadata.minutesUntil;
      const meetingTitle = metadata.meetingTitle;
      const meetingLocation = metadata.meetingLocation;

      if (minutesUntil === undefined || !meetingTitle) {
        return;
      }

      // Intervention thresholds
      const DEPARTURE_WARNING_MINUTES = 30;
      const URGENT_WARNING_MINUTES = 15;
      const IMMEDIATE_WARNING_MINUTES = 5;

      let shouldIntervene = false;
      let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'LOW';
      let message = '';

      if (minutesUntil <= IMMEDIATE_WARNING_MINUTES && minutesUntil > 0) {
        shouldIntervene = true;
        priority = 'URGENT';
        message = `Your meeting "${meetingTitle}" starts in ${minutesUntil} minutes. Join now if it's virtual, or leave immediately if you're not there yet.`;
      } else if (minutesUntil <= URGENT_WARNING_MINUTES && minutesUntil > IMMEDIATE_WARNING_MINUTES) {
        shouldIntervene = true;
        priority = 'HIGH';
        message = `Meeting "${meetingTitle}" starts in ${minutesUntil} minutes. ${meetingLocation ? `Location: ${meetingLocation}. ` : ''}Time to leave soon.`;
      } else if (minutesUntil <= DEPARTURE_WARNING_MINUTES && minutesUntil > URGENT_WARNING_MINUTES) {
        shouldIntervene = true;
        priority = 'MEDIUM';
        message = `You have a meeting "${meetingTitle}" in ${minutesUntil} minutes. ${meetingLocation ? `Consider checking traffic to ${meetingLocation}.` : 'Start preparing.'}`;
      }

      if (shouldIntervene) {
        const intervention: Intervention = {
          id: `meeting_${Date.now()}`,
          type: 'REMINDER',
          title: '📅 Upcoming Meeting',
          message,
          priority,
          context,
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };

        await this.triggerIntervention(intervention);
      }

    } catch (error) {
      console.error('[InterventionEngine] Error in meeting departure intervention:', error);
    }
  }

  /**
   * Commuting Intervention
   */
  private async checkCommutingIntervention(context: FusedContext) {
    try {
      const intervention: Intervention = {
        id: `commute_${Date.now()}`,
        type: 'INFO',
        title: '🚗 Commuting Detected',
        message: context.insights.description,
        priority: 'LOW',
        context,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };

      await this.triggerIntervention(intervention);

    } catch (error) {
      console.error('[InterventionEngine] Error in commuting intervention:', error);
    }
  }

  /**
   * Process recommendations from context
   */
  private async processContextRecommendations(context: FusedContext) {
    try {
      if (!context.recommendations || context.recommendations.length === 0) {
        return;
      }

      // Take the most important recommendation
      const recommendation = context.recommendations[0];

      const intervention: Intervention = {
        id: `rec_${Date.now()}`,
        type: 'SUGGESTION',
        title: '💡 LifeOS Suggestion',
        message: recommendation,
        priority: 'MEDIUM',
        context,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };

      await this.triggerIntervention(intervention);

    } catch (error) {
      console.error('[InterventionEngine] Error processing recommendations:', error);
    }
  }

  /**
   * Trigger an intervention (notification + storage)
   */
  private async triggerIntervention(intervention: Intervention) {
    try {
      // Store intervention
      this.interventions.push(intervention);

      console.log(`[InterventionEngine] Triggering intervention: ${intervention.title}`);

      // Send notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: intervention.title,
          body: intervention.message,
          priority: this.mapPriorityToNotification(intervention.priority),
          sound: intervention.priority === 'URGENT' ? 'default' : undefined,
          data: {
            interventionId: intervention.id,
            contextType: intervention.context.contextType,
          },
        },
        trigger: null, // Immediate
      });

      console.log(`[InterventionEngine] Intervention sent: ${intervention.id}`);

    } catch (error) {
      console.error('[InterventionEngine] Error triggering intervention:', error);
    }
  }

  /**
   * Map intervention priority to notification priority
   */
  private mapPriorityToNotification(priority: string): any {
    switch (priority) {
      case 'URGENT':
        return 'max';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'low';
      default:
        return 'default';
    }
  }

  /**
   * Get recent interventions
   */
  getInterventions(limit: number = 10): Intervention[] {
    return this.interventions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Acknowledge an intervention
   */
  acknowledgeIntervention(interventionId: string) {
    const intervention = this.interventions.find(i => i.id === interventionId);
    if (intervention) {
      intervention.acknowledged = true;
      console.log(`[InterventionEngine] Intervention acknowledged: ${interventionId}`);
    }
  }

  /**
   * Clear old interventions
   */
  clearOldInterventions(daysToKeep: number = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    this.interventions = this.interventions.filter(
      i => new Date(i.timestamp) > cutoff
    );
  }
}
