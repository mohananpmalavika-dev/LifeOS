/**
 * Notification Intelligence Service (Backend)
 * 
 * Processes intelligently-classified notification events from edge devices.
 * Handles entity resolution, knowledge graph updates, and task creation.
 */

import type { LifeEvent } from '../../types/life-event.js';
import { EntityResolutionEngine } from './entity-resolution-engine.js';
import { lifeosService } from './lifeos-service.js';

export interface ProcessingResult {
  eventId: string;
  entityId: string | null;
  linkedToExisting: boolean;
  taskCreated: boolean;
  graphUpdated: boolean;
}

export interface BatchResult {
  processed: number;
  linked: number;
  tasksCreated: number;
  graphUpdates: number;
  errors: Array<{ eventId: string; error: string }>;
}

export interface NotificationEntity {
  entityId: string;
  type: string; // BILL, APPOINTMENT, ORDER, etc.
  category: string; // FINANCE, HEALTH, etc.
  
  // Core properties
  name?: string;
  organization?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  status: string;
  
  // Relationships
  relatedEvents: string[];
  linkedTasks: string[];
  
  // History
  firstSeen: string;
  lastUpdated: string;
  updateCount: number;
  
  // Metadata
  confidence: number;
  metadata: Record<string, any>;
}

export class NotificationIntelligenceService {
  private entityResolver: EntityResolutionEngine;
  private entityStore: Map<string, NotificationEntity>;

  constructor() {
    this.entityResolver = new EntityResolutionEngine();
    this.entityStore = new Map();
  }

  /**
   * Process an intelligently classified notification event
   */
  async processIntelligentEvent(event: LifeEvent): Promise<ProcessingResult> {
    console.log(`Processing intelligent event: ${event.eventId}`);

    try {
      // Extract notification intelligence metadata
      const intent = event.metadata?.notificationIntent;
      const category = event.metadata?.notificationCategory;
      const amount = event.metadata?.amount;
      const dueDate = event.metadata?.dueDate;
      const organization = event.metadata?.organization;

      console.log(`  Intent: ${intent}, Category: ${category}`);

      // Step 1: Entity resolution - find or create entity
      const entity = await this.resolveEntityForEvent(event);
      console.log(`  Entity: ${entity.entityId} (${entity.linkedToExisting ? 'existing' : 'new'})`);

      // Step 2: Update entity with new information
      await this.updateEntity(entity.entityId, event);

      // Step 3: Determine if task should be created
      const taskCreated = await this.maybeCreateTask(event, entity.entityId);

      // Step 4: Update context graph
      const graphUpdated = await this.updateContextGraph(event, entity.entityId);

      // Step 5: Process through LifeOS core for reasoning
      await lifeosService.processNotificationEvent(event);

      return {
        eventId: event.eventId,
        entityId: entity.entityId,
        linkedToExisting: entity.linkedToExisting,
        taskCreated,
        graphUpdated,
      };

    } catch (error: any) {
      console.error(`Error processing event ${event.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of events
   */
  async processBatch(events: LifeEvent[]): Promise<BatchResult> {
    const result: BatchResult = {
      processed: 0,
      linked: 0,
      tasksCreated: 0,
      graphUpdates: 0,
      errors: [],
    };

    for (const event of events) {
      try {
        const eventResult = await this.processIntelligentEvent(event);
        
        result.processed++;
        if (eventResult.linkedToExisting) result.linked++;
        if (eventResult.taskCreated) result.tasksCreated++;
        if (eventResult.graphUpdated) result.graphUpdates++;

      } catch (error: any) {
        result.errors.push({
          eventId: event.eventId,
          error: error.message,
        });
      }
    }

    console.log(`📊 Batch complete: ${result.processed}/${events.length} processed, ${result.linked} linked, ${result.tasksCreated} tasks created`);

    return result;
  }

  /**
   * Resolve entity for an event
   */
  private async resolveEntityForEvent(event: LifeEvent): Promise<{
    entityId: string;
    linkedToExisting: boolean;
  }> {
    // Try to find existing entity
    const existingEntity = await this.entityResolver.findMatchingEntity(event);

    if (existingEntity) {
      return {
        entityId: existingEntity.entityId,
        linkedToExisting: true,
      };
    }

    // Create new entity
    const newEntity = await this.createEntity(event);
    
    return {
      entityId: newEntity.entityId,
      linkedToExisting: false,
    };
  }

  /**
   * Create new entity from event
   */
  private async createEntity(event: LifeEvent): Promise<NotificationEntity> {
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const entity: NotificationEntity = {
      entityId,
      type: this.mapIntentToEntityType(event.metadata?.notificationIntent),
      category: event.metadata?.notificationCategory || 'OTHER',
      
      name: this.extractEntityName(event),
      organization: event.metadata?.organization,
      amount: event.metadata?.amount,
      currency: event.metadata?.currency,
      dueDate: event.metadata?.dueDate,
      status: 'PENDING',
      
      relatedEvents: [event.eventId],
      linkedTasks: [],
      
      firstSeen: event.timestamp,
      lastUpdated: event.timestamp,
      updateCount: 1,
      
      confidence: event.confidence || 0.5,
      metadata: { ...event.metadata },
    };

    this.entityStore.set(entityId, entity);
    console.log(`  Created entity: ${entityId} (${entity.type})`);

    return entity;
  }

  /**
   * Update existing entity with new event information
   */
  private async updateEntity(entityId: string, event: LifeEvent): Promise<void> {
    const entity = this.entityStore.get(entityId);
    if (!entity) {
      console.error(`Entity ${entityId} not found`);
      return;
    }

    // Add event to related events
    if (!entity.relatedEvents.includes(event.eventId)) {
      entity.relatedEvents.push(event.eventId);
    }

    // Update fields if new information is more confident
    if (event.metadata?.amount && 
        (!entity.amount || event.confidence! > entity.confidence)) {
      entity.amount = event.metadata.amount;
      entity.currency = event.metadata.currency;
    }

    if (event.metadata?.dueDate && 
        (!entity.dueDate || event.confidence! > entity.confidence)) {
      entity.dueDate = event.metadata.dueDate;
    }

    if (event.metadata?.organization && 
        (!entity.organization || event.confidence! > entity.confidence)) {
      entity.organization = event.metadata.organization;
    }

    // Update status based on keywords
    if (event.metadata?.notificationIntent === 'REMINDER') {
      entity.status = 'REMINDER_SENT';
    } else if (event.metadata?.notificationIntent === 'PAYMENT') {
      entity.status = 'PAID';
    }

    // Update metadata
    entity.lastUpdated = event.timestamp;
    entity.updateCount++;
    entity.confidence = Math.max(entity.confidence, event.confidence || 0.5);

    console.log(`  Updated entity ${entityId}: ${entity.updateCount} events`);
  }

  /**
   * Maybe create a task from the event
   */
  private async maybeCreateTask(event: LifeEvent, entityId: string): Promise<boolean> {
    const intent = event.metadata?.notificationIntent;
    const action = event.metadata?.notificationAction;

    // Only create tasks for actionable intents
    if (intent !== 'BILL_DUE' && 
        intent !== 'APPOINTMENT' && 
        intent !== 'REMINDER') {
      return false;
    }

    // Check if task already exists for this entity
    const entity = this.entityStore.get(entityId);
    if (entity && entity.linkedTasks.length > 0) {
      console.log(`  Task already exists for entity ${entityId}`);
      return false;
    }

    // Create task
    const taskTitle = this.generateTaskTitle(event);
    const taskDueDate = event.metadata?.dueDate;

    console.log(`  Creating task: "${taskTitle}"`);

    // In production, this would call your task management system
    // For now, just log
    
    if (entity) {
      entity.linkedTasks.push(`task_${Date.now()}`);
    }

    return true;
  }

  /**
   * Update context graph with entity
   */
  private async updateContextGraph(event: LifeEvent, entityId: string): Promise<boolean> {
    try {
      // In production, this would update your knowledge graph
      // For now, just indicate success
      console.log(`  Updated context graph for entity ${entityId}`);
      return true;
    } catch (error) {
      console.error('Error updating context graph:', error);
      return false;
    }
  }

  /**
   * Map notification intent to entity type
   */
  private mapIntentToEntityType(intent?: string): string {
    const mapping: Record<string, string> = {
      'BILL_DUE': 'BILL',
      'PAYMENT': 'TRANSACTION',
      'DELIVERY': 'ORDER',
      'APPOINTMENT': 'APPOINTMENT',
      'TRAVEL': 'TRIP',
      'REMINDER': 'REMINDER',
    };

    return mapping[intent || ''] || 'EVENT';
  }

  /**
   * Extract entity name from event
   */
  private extractEntityName(event: LifeEvent): string {
    const intent = event.metadata?.notificationIntent;
    const organization = event.metadata?.organization;

    if (intent === 'BILL_DUE' && organization) {
      return `${organization} Bill`;
    }

    if (intent === 'APPOINTMENT' && organization) {
      return `${organization} Appointment`;
    }

    if (intent === 'DELIVERY' && organization) {
      return `${organization} Delivery`;
    }

    return event.metadata?.sourceAppName || 'Notification';
  }

  /**
   * Generate task title from event
   */
  private generateTaskTitle(event: LifeEvent): string {
    const action = event.metadata?.requiredAction || 'Review';
    const organization = event.metadata?.organization || event.metadata?.sourceAppName;
    const intent = event.metadata?.notificationIntent;

    if (intent === 'BILL_DUE') {
      return `Pay ${organization} bill`;
    }

    if (intent === 'APPOINTMENT') {
      return `Attend ${organization} appointment`;
    }

    return `${action} ${organization}`;
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityId: string): Promise<NotificationEntity | null> {
    return this.entityStore.get(entityId) || null;
  }

  /**
   * Get statistics for a device
   */
  async getDeviceStats(deviceId: string): Promise<any> {
    // In production, query database for device-specific stats
    return {
      deviceId,
      totalEvents: this.entityStore.size,
      entities: this.entityStore.size,
      // Add more stats as needed
    };
  }

  /**
   * Manually trigger entity resolution
   */
  async resolveEntity(eventId: string): Promise<any> {
    // In production, look up event and resolve
    return {
      eventId,
      resolved: true,
      message: 'Entity resolution triggered',
    };
  }
}
