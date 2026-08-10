import ContextEngine from "../../engine.js";
import { eventBus } from "../../event-bus.js";
import type { 
  NormalizedEvent, 
  Intervention, 
  ContextEntity, 
  ContextRelation,
  SensorState 
} from "../../types.js";

/**
 * Singleton service that wraps the LifeOS engine for API access
 */
class LifeOSService {
  private engine: ContextEngine;
  private interventions: Map<string, Intervention> = new Map();
  private processedEvents: Array<{
    event: NormalizedEvent;
    confidence: any;
    intervention: Intervention | null;
    timestamp: string;
  }> = [];

  constructor() {
    this.engine = new ContextEngine();
    this.setupEventSubscription();
  }

  private setupEventSubscription() {
    eventBus.subscribe(async (event: NormalizedEvent) => {
      try {
        const result = await this.engine.process(event);
        
        // Store the intervention if it was triggered
        if (result.intervention) {
          this.interventions.set(result.intervention.id, result.intervention);
        }

        // Store processed event for timeline
        this.processedEvents.push({
          event: result.event,
          confidence: result.confidence,
          intervention: result.intervention,
          timestamp: new Date().toISOString(),
        });

        // Keep only last 1000 events
        if (this.processedEvents.length > 1000) {
          this.processedEvents = this.processedEvents.slice(-1000);
        }
      } catch (error) {
        console.error("Error processing event:", error);
      }
    });
  }

  /**
   * Process a new event through the engine
   */
  async processEvent(event: NormalizedEvent) {
    return await this.engine.process(event);
  }

  /**
   * Publish an event to the event bus
   */
  publishEvent(event: NormalizedEvent) {
    eventBus.publish(event);
  }

  /**
   * Get all interventions
   */
  getInterventions(filters?: {
    priority?: "high" | "medium" | "low";
    limit?: number;
    dismissed?: boolean;
  }) {
    let interventions = Array.from(this.interventions.values());

    // Sort by score (highest first)
    interventions.sort((a, b) => b.score - a.score);

    // Apply filters
    if (filters?.priority) {
      const scoreThresholds = {
        high: 0.80,
        medium: 0.65,
        low: 0.50,
      };
      const threshold = scoreThresholds[filters.priority];
      interventions = interventions.filter((i) => i.score >= threshold);
    }

    if (filters?.limit) {
      interventions = interventions.slice(0, filters.limit);
    }

    return interventions;
  }

  /**
   * Get a specific intervention by ID
   */
  getIntervention(id: string): Intervention | null {
    return this.interventions.get(id) || null;
  }

  /**
   * Dismiss an intervention
   */
  dismissIntervention(id: string): boolean {
    return this.interventions.delete(id);
  }

  /**
   * Get timeline events
   */
  getTimeline(filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    let events = [...this.processedEvents];

    // Filter by date range
    if (filters?.startDate) {
      const start = new Date(filters.startDate);
      events = events.filter((e) => new Date(e.timestamp) >= start);
    }

    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      events = events.filter((e) => new Date(e.timestamp) <= end);
    }

    // Sort by timestamp (most recent first)
    events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Get context graph entities
   */
  getEntities(filters?: {
    type?: string;
    search?: string;
    limit?: number;
  }): ContextEntity[] {
    let entities = this.engine.getGraph().getEntities();

    if (filters?.type) {
      entities = entities.filter((e) => e.type === filters.type);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      entities = entities.filter((e) =>
        e.title.toLowerCase().includes(searchLower) ||
        JSON.stringify(e.properties).toLowerCase().includes(searchLower)
      );
    }

    if (filters?.limit) {
      entities = entities.slice(0, filters.limit);
    }

    return entities;
  }

  /**
   * Get a specific entity by ID
   */
  getEntity(id: string): ContextEntity | undefined {
    return this.engine.getGraph().getEntities().find((e) => e.id === id);
  }

  /**
   * Get context graph relations
   */
  getRelations(filters?: {
    sourceId?: string;
    targetId?: string;
    type?: string;
  }): ContextRelation[] {
    let relations = this.engine.getGraph().getRelations();

    if (filters?.sourceId) {
      relations = relations.filter((r) => r.sourceId === filters.sourceId);
    }

    if (filters?.targetId) {
      relations = relations.filter((r) => r.targetId === filters.targetId);
    }

    if (filters?.type) {
      relations = relations.filter((r) => r.type === filters.type);
    }

    return relations;
  }

  /**
   * Get related entities for a given entity
   */
  getRelatedEntities(entityId: string, relationType?: string) {
    const graph = this.engine.getGraph();
    return graph.findRelatedEntities(
      entityId, 
      relationType as any, 
      'both'
    );
  }

  /**
   * Get current sensor state
   */
  getSensorState(): SensorState {
    return this.engine.sensorState;
  }

  /**
   * Update sensor state
   */
  updateSensorState(updates: Partial<SensorState>) {
    this.engine.updateSensorState(updates);
  }

  /**
   * Get system insights and metrics
   */
  getInsights() {
    const entities = this.engine.getGraph().getEntities();
    const relations = this.engine.getGraph().getRelations();
    const interventions = Array.from(this.interventions.values());
    const events = this.processedEvents;

    // Calculate metrics
    const totalInterventions = interventions.length;
    const highPriorityInterventions = interventions.filter((i) => i.score >= 0.80).length;
    
    // Context accuracy metrics (from benchmark)
    const contextAccuracy = 0.96; // 96% from latest benchmark
    const precision = 1.00; // 100% precision
    const recall = 0.575; // 57.5% recall
    const f1Score = 0.730; // 73.0% F1 score

    // Entity type distribution
    const entityTypeDistribution = entities.reduce((acc, entity) => {
      acc[entity.type] = (acc[entity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Relation type distribution
    const relationTypeDistribution = relations.reduce((acc, relation) => {
      acc[relation.type] = (acc[relation.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Intervention analytics
    const avgInterventionScore = interventions.length > 0
      ? interventions.reduce((sum, i) => sum + i.score, 0) / interventions.length
      : 0;

    // Recent event activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = events.filter(
      (e) => new Date(e.timestamp) >= last24Hours
    );

    return {
      metrics: {
        contextAccuracy,
        precision,
        recall,
        f1Score,
        falsePositives: 0, // From benchmark
      },
      counts: {
        totalEntities: entities.length,
        totalRelations: relations.length,
        totalInterventions,
        highPriorityInterventions,
        recentEvents: recentEvents.length,
      },
      distributions: {
        entityTypes: entityTypeDistribution,
        relationTypes: relationTypeDistribution,
      },
      interventionAnalytics: {
        avgScore: avgInterventionScore,
        scoreDistribution: {
          high: interventions.filter((i) => i.score >= 0.80).length,
          medium: interventions.filter((i) => i.score >= 0.65 && i.score < 0.80).length,
          low: interventions.filter((i) => i.score < 0.65).length,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Derive tasks from context graph
   */
  deriveTasks() {
    const entities = this.engine.getGraph().getEntities();
    const relations = this.engine.getGraph().getRelations();
    const tasks: Array<{
      id: string;
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      dueDate?: string;
      context: string[];
      derivedFrom: string[];
    }> = [];

    // Find events that require documents
    const requiresRelations = relations.filter((r) => r.type === "REQUIRES");
    
    for (const rel of requiresRelations) {
      const sourceEntity = entities.find((e) => e.id === rel.sourceId);
      const targetEntity = entities.find((e) => e.id === rel.targetId);

      if (sourceEntity?.type === "Event" && targetEntity?.type === "Document") {
        const dueDate = (sourceEntity.properties as any).iso;
        const priority = dueDate ? this.calculatePriority(dueDate) : "medium";

        tasks.push({
          id: `task:${sourceEntity.id}:${targetEntity.id}`,
          title: `Prepare ${targetEntity.title} for ${sourceEntity.title}`,
          description: `Ensure ${targetEntity.title} is ready before ${sourceEntity.title}`,
          priority,
          dueDate,
          context: [sourceEntity.title, targetEntity.title],
          derivedFrom: [sourceEntity.id, targetEntity.id],
        });
      }
    }

    // Find dependencies
    const dependsRelations = relations.filter((r) => r.type === "DEPENDS_ON");
    
    for (const rel of dependsRelations) {
      const sourceEntity = entities.find((e) => e.id === rel.sourceId);
      const targetEntity = entities.find((e) => e.id === rel.targetId);

      if (sourceEntity && targetEntity) {
        const dueDate = (sourceEntity.properties as any).iso;
        const priority = dueDate ? this.calculatePriority(dueDate) : "medium";

        tasks.push({
          id: `task:${sourceEntity.id}:depends:${targetEntity.id}`,
          title: `${sourceEntity.title} depends on ${targetEntity.title}`,
          description: `Complete ${targetEntity.title} before ${sourceEntity.title}`,
          priority,
          dueDate,
          context: [sourceEntity.title, targetEntity.title],
          derivedFrom: [sourceEntity.id, targetEntity.id],
        });
      }
    }

    return tasks;
  }

  private calculatePriority(isoDate: string): "high" | "medium" | "low" {
    try {
      const dueDate = new Date(isoDate);
      const now = new Date();
      const hoursUntil = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil <= 6) return "high";
      if (hoursUntil <= 24) return "medium";
      return "low";
    } catch {
      return "medium";
    }
  }
}

// Export singleton instance
export const lifeosService = new LifeOSService();
