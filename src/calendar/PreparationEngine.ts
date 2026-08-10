/**
 * Preparation Engine
 * 
 * Analyzes event requirements and generates preparation plans
 */

import { 
  EnrichedCalendarEvent, 
  PreparationPlan, 
  PreparationItem, 
  EventType,
  DocumentRequirement 
} from './types';
import { EventClassifier } from './EventClassifier';
import Database from 'better-sqlite3';

export class PreparationEngine {
  constructor(
    private db: Database.Database,
    private eventClassifier: EventClassifier
  ) {}
  
  /**
   * Generate preparation plan for an event
   */
  generatePreparationPlan(event: EnrichedCalendarEvent): PreparationPlan {
    const items: PreparationItem[] = [];
    
    // Get event type profile
    const profile = event.eventType 
      ? this.eventClassifier.getProfile(event.eventType)
      : null;
    
    if (!profile || profile.preparationLikelihood < 0.3) {
      return {
        required: false,
        estimatedMinutes: 0,
        items: []
      };
    }
    
    // Add document preparation items
    if (event.requiredDocuments.length > 0) {
      const missingDocs = event.requiredDocuments.filter(d => d.required && !d.available);
      
      if (missingDocs.length > 0) {
        items.push({
          type: 'DOCUMENT',
          description: `Gather required documents: ${missingDocs.map(d => d.name).join(', ')}`,
          deadline: this.calculateDeadline(event, 60), // 1 hour before
          completed: false,
          confidence: 0.85
        });
      }
    }
    
    // Add travel preparation if needed
    if (event.travelRequirement?.required) {
      items.push({
        type: 'TRAVEL',
        description: `Depart for ${event.place?.name || 'destination'} by ${new Date(event.travelRequirement.requiredDepartureTime).toLocaleTimeString()}`,
        deadline: event.travelRequirement.requiredDepartureTime,
        completed: false,
        confidence: event.travelRequirement.confidence
      });
    }
    
    // Add event-specific preparation tasks
    const specificTasks = this.getEventSpecificTasks(event);
    items.push(...specificTasks);
    
    // Calculate total estimated time
    const estimatedMinutes = this.estimatePreparationTime(event, items);
    
    return {
      required: items.length > 0,
      estimatedMinutes,
      items
    };
  }
  
  /**
   * Get event-specific preparation tasks
   */
  private getEventSpecificTasks(event: EnrichedCalendarEvent): PreparationItem[] {
    const tasks: PreparationItem[] = [];
    
    switch (event.eventType) {
      case EventType.WORK_MEETING:
        if (event.event.description?.toLowerCase().includes('presentation')) {
          tasks.push({
            type: 'TASK',
            description: 'Prepare presentation materials',
            deadline: this.calculateDeadline(event, 120), // 2 hours before
            completed: false,
            confidence: 0.75
          });
        }
        
        tasks.push({
          type: 'TASK',
          description: 'Review meeting agenda',
          deadline: this.calculateDeadline(event, 30),
          completed: false,
          confidence: 0.65
        });
        break;
        
      case EventType.MEDICAL_APPOINTMENT:
        tasks.push({
          type: 'TASK',
          description: 'Bring medical history and current medications list',
          deadline: this.calculateDeadline(event, 60),
          completed: false,
          confidence: 0.80
        });
        break;
        
      case EventType.EXAM:
        tasks.push({
          type: 'TASK',
          description: 'Gather study materials and stationery',
          deadline: this.calculateDeadline(event, 120),
          completed: false,
          confidence: 0.90
        });
        break;
        
      case EventType.FLIGHT:
        tasks.push({
          type: 'TASK',
          description: 'Complete online check-in',
          deadline: this.calculateDeadline(event, 1440), // 24 hours before
          completed: false,
          confidence: 0.85
        });
        
        tasks.push({
          type: 'TASK',
          description: 'Pack luggage',
          deadline: this.calculateDeadline(event, 480), // 8 hours before
          completed: false,
          confidence: 0.80
        });
        break;
        
      case EventType.GOVERNMENT:
      case EventType.LEGAL:
        tasks.push({
          type: 'TASK',
          description: 'Verify all required documents are complete',
          deadline: this.calculateDeadline(event, 1440),
          completed: false,
          confidence: 0.85
        });
        break;
        
      case EventType.RESTAURANT:
        if (event.event.attendees.length > 2) {
          tasks.push({
            type: 'TASK',
            description: 'Confirm reservation',
            deadline: this.calculateDeadline(event, 120),
            completed: false,
            confidence: 0.70
          });
        }
        break;
    }
    
    return tasks;
  }
  
  /**
   * Estimate total preparation time
   */
  private estimatePreparationTime(event: EnrichedCalendarEvent, items: PreparationItem[]): number {
    const baseTime: Record<EventType, number> = {
      [EventType.MEDICAL_APPOINTMENT]: 15,
      [EventType.WORK_MEETING]: 30,
      [EventType.EXAM]: 60,
      [EventType.FLIGHT]: 120,
      [EventType.TRAIN]: 30,
      [EventType.GOVERNMENT]: 45,
      [EventType.LEGAL]: 60,
      [EventType.EDUCATION]: 30,
      [EventType.PERSONAL_MEETING]: 15,
      [EventType.RESTAURANT]: 10,
      [EventType.SHOPPING]: 10,
      [EventType.BANKING]: 15,
      [EventType.SPORT]: 20,
      [EventType.EXERCISE]: 15,
      [EventType.FAMILY]: 20,
      [EventType.BIRTHDAY]: 30,
      [EventType.ANNIVERSARY]: 45,
      [EventType.BUS]: 15,
      [EventType.DELIVERY]: 5,
      [EventType.TRAVEL]: 180,
      [EventType.OTHER]: 15
    };
    
    const base = event.eventType ? baseTime[event.eventType] : 15;
    
    // Add time for each preparation item
    const itemTime = items.length * 10;
    
    // Add time for document gathering
    const missingDocs = event.requiredDocuments.filter(d => d.required && !d.available);
    const docTime = missingDocs.length * 15;
    
    return base + itemTime + docTime;
  }
  
  /**
   * Calculate deadline for preparation task
   */
  private calculateDeadline(event: EnrichedCalendarEvent, minutesBefore: number): string {
    const eventStart = new Date(event.event.startTime);
    const deadline = new Date(eventStart.getTime() - minutesBefore * 60000);
    return deadline.toISOString();
  }
  
  /**
   * Check if preparation is on track
   */
  checkPreparationStatus(plan: PreparationPlan, currentTime: Date): {
    onTrack: boolean;
    overdueItems: PreparationItem[];
    upcomingItems: PreparationItem[];
  } {
    const overdueItems: PreparationItem[] = [];
    const upcomingItems: PreparationItem[] = [];
    
    for (const item of plan.items) {
      if (item.completed) continue;
      
      if (item.deadline) {
        const deadline = new Date(item.deadline);
        
        if (deadline < currentTime) {
          overdueItems.push(item);
        } else {
          const hoursUntilDeadline = (deadline.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
          
          if (hoursUntilDeadline <= 24) {
            upcomingItems.push(item);
          }
        }
      }
    }
    
    return {
      onTrack: overdueItems.length === 0,
      overdueItems,
      upcomingItems
    };
  }
  
  /**
   * Mark preparation item as completed
   */
  markItemCompleted(plan: PreparationPlan, itemDescription: string): PreparationPlan {
    return {
      ...plan,
      items: plan.items.map(item => 
        item.description === itemDescription
          ? { ...item, completed: true }
          : item
      )
    };
  }
  
  /**
   * Get preparation reminder time
   */
  getPreparationReminderTime(item: PreparationItem): Date | null {
    if (!item.deadline) return null;
    
    const deadline = new Date(item.deadline);
    
    // Remind based on item type
    const reminderOffsets: Record<string, number> = {
      'DOCUMENT': 60, // 1 hour before deadline
      'TASK': 120,    // 2 hours before deadline
      'TRAVEL': 15,   // 15 minutes before departure
      'RESOURCE': 60
    };
    
    const offset = reminderOffsets[item.type] || 60;
    return new Date(deadline.getTime() - offset * 60000);
  }
}
