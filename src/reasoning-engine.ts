import { ConfidenceWeights, NormalizedEvent, SensorState } from "./types.js";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function evaluateEvent(
  event: NormalizedEvent,
  state: SensorState,
): { relevance: number; confidence: number; recommendation: string } {
  let relevance = event.confidence;

  if (state.motionState !== "stationary") {
    relevance += 0.05;
  }

  if (state.location.placeLabel) {
    relevance += 0.05;
  }

  if (state.batteryLevel < 0.3) {
    relevance -= 0.05;
  }

  const recommendation = "Review whether this event requires follow-up based on your current context.";

  return {
    relevance: clamp(relevance),
    confidence: event.confidence,
    recommendation,
  };
}

export function deriveConfidenceSubscores(
  event: NormalizedEvent,
  state: SensorState,
): ConfidenceWeights {
  const hasTime = event.entities.some((item) => /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2})\b/i.test(item));
  const hasLocation = event.entities.some((item) => /\b(home|office|hospital|clinic|pharmacy|store|bank|school|airport|station|hotel|restaurant)\b/i.test(item));
  const completeness = clamp(
    0.4 + (hasTime ? 0.2 : 0) + (hasLocation ? 0.2 : 0) + (event.entities.length >= 2 ? 0.1 : 0),
  );

  const pIntent = clamp(event.confidence * 0.75 + completeness * 0.25);

  const spatialBonus = state.location.geofence ? 0.1 : 0;
  const motionMatch = state.motionState === "walking" ? 0.1 : state.motionState === "stationary" ? 0.05 : 0;
  const cState = clamp(0.65 + spatialBonus + motionMatch - (state.batteryLevel < 0.25 ? 0.1 : 0));

  const shown = typeof event.metadata.history?.shown === "number" ? event.metadata.history.shown : 0;
  const accepted = typeof event.metadata.history?.accepted === "number" ? event.metadata.history.accepted : 0;
  const alpha = 2;
  const beta = 8;
  const aHistorical = clamp((accepted + alpha) / (shown + alpha + beta));

  const eUrgency = clamp(hasTime ? 0.85 : 0.45);

  return {
    pIntent,
    cState,
    aHistorical,
    eUrgency,
  };
}

// Cross-event inference using the ContextGraph.
import { ContextGraph } from "./context-engine.js";
import type { ContextEntity, ContextRelation } from "./types.js";

function normalizeTextValue(value: unknown): string {
  return String(value || "").toLowerCase().trim();
}

/**
 * Performs multi-hop traversal to find relationships between entities
 * Example: Event -> REQUIRES -> Document -> MENTIONED_IN -> Person -> MENTIONED_IN -> Appointment
 */
function findMultiHopRelationships(
  graph: ContextGraph,
  startEntityId: string,
  maxDepth: number = 3
): Array<{ entity: ContextEntity; path: ContextRelation[]; depth: number }> {
  const entities = graph.getEntities();
  const relations = graph.getRelations();
  const visited = new Set<string>();
  const results: Array<{ entity: ContextEntity; path: ContextRelation[]; depth: number }> = [];
  
  interface QueueItem {
    entityId: string;
    path: ContextRelation[];
    depth: number;
  }
  
  const queue: QueueItem[] = [{ entityId: startEntityId, path: [], depth: 0 }];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.entityId) || current.depth >= maxDepth) {
      continue;
    }
    
    visited.add(current.entityId);
    
    const entity = entities.find(e => e.id === current.entityId);
    if (entity && current.depth > 0) {
      results.push({ entity, path: current.path, depth: current.depth });
    }
    
    // Find all relations connected to this entity
    const connectedRelations = relations.filter(
      r => r.sourceId === current.entityId || r.targetId === current.entityId
    );
    
    for (const rel of connectedRelations) {
      const nextEntityId = rel.sourceId === current.entityId ? rel.targetId : rel.sourceId;
      
      if (!visited.has(nextEntityId)) {
        queue.push({
          entityId: nextEntityId,
          path: [...current.path, rel],
          depth: current.depth + 1
        });
      }
    }
  }
  
  return results;
}

/**
 * Finds semantically related entities by analyzing shared relationships
 */
function findSemanticallySimilarEntities(
  graph: ContextGraph,
  entity: ContextEntity
): ContextEntity[] {
  const relations = graph.getRelations();
  const entities = graph.getEntities();
  
  // Find entities that share multiple relationships with the same targets
  const targetIds = new Set(
    relations
      .filter(r => r.sourceId === entity.id)
      .map(r => r.targetId)
  );
  
  const similar: Map<string, number> = new Map();
  
  for (const rel of relations) {
    if (rel.sourceId !== entity.id && targetIds.has(rel.targetId)) {
      similar.set(rel.sourceId, (similar.get(rel.sourceId) || 0) + 1);
    }
  }
  
  // Return entities with 2+ shared connections
  return Array.from(similar.entries())
    .filter(([_, count]) => count >= 2)
    .map(([id]) => entities.find(e => e.id === id))
    .filter((e): e is ContextEntity => e !== undefined);
}

/**
 * Analyzes temporal proximity between events
 */
function analyzeTemporalProximity(
  eventEntity: ContextEntity,
  relatedEntity: ContextEntity
): { isProximate: boolean; hoursApart: number } {
  try {
    const eventTime = (eventEntity.properties as any).iso;
    const relatedTime = (relatedEntity.properties as any).iso;
    
    if (!eventTime || !relatedTime) {
      return { isProximate: false, hoursApart: Infinity };
    }
    
    const eventDate = new Date(eventTime);
    const relatedDate = new Date(relatedTime);
    const hoursApart = Math.abs(eventDate.getTime() - relatedDate.getTime()) / (1000 * 60 * 60);
    
    return {
      isProximate: hoursApart <= 24,
      hoursApart
    };
  } catch (e) {
    return { isProximate: false, hoursApart: Infinity };
  }
}

export function analyzeContext(graph: ContextGraph, event: NormalizedEvent, state: SensorState) {
  try {
    const entities = graph.getEntities();
    const relations = graph.getRelations();
    const structured = (event.metadata && (event.metadata as any).structured) || {};
    
    const person = normalizeTextValue(structured.person);
    const place = normalizeTextValue(structured.place);
    const objectValue = normalizeTextValue(structured.object);
    const timeValue = structured.time;

    let pIntentBoost = 0;
    let eUrgencyBoost = 0;
    let reasonParts: string[] = [];

    // Level 1: Direct entity matching (existing logic, improved)
    const appointments = entities.filter((e) => 
      e.type === "Event" && 
      e.properties && 
      ((e.properties as any).iso || (e.properties as any).place)
    );
    
    const directMatches = appointments.filter((appt) => {
      const apptPerson = normalizeTextValue((appt.properties as any).person);
      const apptPlace = normalizeTextValue((appt.properties as any).place);
      return (person && apptPerson && apptPerson === person) || 
             (place && apptPlace && apptPlace === place) || 
             (objectValue && apptPlace && apptPlace === objectValue);
    });

    if (directMatches.length > 0) {
      pIntentBoost += 0.10;
      eUrgencyBoost += 0.10;
      reasonParts.push("direct_entity_match");
    }

    // Level 2: Multi-hop relationship detection
    const eventEntityId = `event:${event.id}`;
    const multiHopRelated = findMultiHopRelationships(graph, eventEntityId, 3);
    
    // Check for appointment connections through documents or people
    const appointmentConnections = multiHopRelated.filter(result => 
      result.entity.type === "Event" && (result.entity.properties as any).iso
    );
    
    if (appointmentConnections.length > 0) {
      // Check the relationship path quality
      for (const connection of appointmentConnections) {
        const hasRequiresRelation = connection.path.some(r => r.type === "REQUIRES");
        const hasDependsRelation = connection.path.some(r => r.type === "DEPENDS_ON");
        
        if (hasRequiresRelation || hasDependsRelation) {
          pIntentBoost += 0.15;
          eUrgencyBoost += 0.12;
          reasonParts.push("multi_hop_dependency");
          
          // Check temporal proximity
          const temporal = analyzeTemporalProximity(
            entities.find(e => e.id === eventEntityId)!,
            connection.entity
          );
          
          if (temporal.isProximate && temporal.hoursApart <= 6) {
            eUrgencyBoost += 0.08;
            reasonParts.push("temporal_proximity_urgent");
          } else if (temporal.isProximate) {
            eUrgencyBoost += 0.05;
            reasonParts.push("temporal_proximity");
          }
          break; // Only boost once for the strongest connection
        }
      }
    }

    // Level 3: Semantic similarity detection
    // Find entities that share relationship patterns with current event
    const currentEventEntity = entities.find(e => e.id === eventEntityId);
    if (currentEventEntity) {
      const similarEntities = findSemanticallySimilarEntities(graph, currentEventEntity);
      const similarAppointments = similarEntities.filter(e => 
        e.type === "Event" && (e.properties as any).iso
      );
      
      if (similarAppointments.length > 0) {
        pIntentBoost += 0.08;
        reasonParts.push("semantic_similarity");
      }
    }

    // Level 4: Cross-entity inference through shared attributes
    // If this event mentions a document, check if any appointments require documents
    if (objectValue) {
      const documentEntities = entities.filter(e => 
        e.type === "Document" && 
        normalizeTextValue(e.title).includes(objectValue)
      );
      
      for (const doc of documentEntities) {
        const requiresRels = relations.filter(r => 
          r.targetId === doc.id && 
          r.type === "REQUIRES"
        );
        
        const requiringAppointments = requiresRels
          .map(r => entities.find(e => e.id === r.sourceId))
          .filter((e): e is ContextEntity => 
            e !== undefined && 
            e.type === "Event" && 
            (e.properties as any).iso
          );
        
        if (requiringAppointments.length > 0) {
          pIntentBoost += 0.12;
          eUrgencyBoost += 0.10;
          reasonParts.push("document_requirement_inference");
          break;
        }
      }
    }

    // Level 5: Location-based context inference
    if (place || state.location.placeLabel) {
      const currentPlace = normalizeTextValue(place || state.location.placeLabel || "");
      
      // Check if leaving from a place related to an appointment destination
      const locationRelatedAppointments = appointments.filter(appt => {
        const apptPlace = normalizeTextValue((appt.properties as any).place);
        return apptPlace && currentPlace && (
          currentPlace === "home" || currentPlace === "leaving"
        ) && apptPlace !== currentPlace;
      });
      
      if (locationRelatedAppointments.length > 0 && state.motionState !== "stationary") {
        pIntentBoost += 0.10;
        eUrgencyBoost += 0.15;
        reasonParts.push("location_departure_inference");
      }
    }

    if (reasonParts.length > 0) {
      return {
        pIntentBoost: Math.min(0.35, pIntentBoost), // Cap boost to avoid over-confidence
        eUrgencyBoost: Math.min(0.35, eUrgencyBoost),
        reason: reasonParts.join("+"),
        relationshipDepth: Math.max(...multiHopRelated.map(r => r.depth), 0)
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}
