import { ContextGraph } from "./context-engine.js";
import type { SensorState, ContextEntity } from "./types.js";

/**
 * Identifies entities that represent external factors (traffic, weather, conditions)
 * based on their semantic type rather than keyword matching
 */
function identifyExternalFactors(entities: ContextEntity[]): {
  traffic: ContextEntity[];
  weather: ContextEntity[];
  other: ContextEntity[];
} {
  const traffic: ContextEntity[] = [];
  const weather: ContextEntity[] = [];
  const other: ContextEntity[] = [];

  for (const entity of entities) {
    // Check if this entity has been semantically tagged or has properties indicating type
    const props = entity.properties as any;
    const title = entity.title.toLowerCase();
    
    // Use entity properties and relations to determine type, not just keywords
    if (entity.type === "Event") {
      // Look for semantic tags in properties
      if (props.category === 'traffic' || props.externalFactor === 'traffic') {
        traffic.push(entity);
      } else if (props.category === 'weather' || props.externalFactor === 'weather') {
        weather.push(entity);
      } else {
        // Fallback: minimal keyword detection for entities not yet properly tagged
        // This should be replaced by better entity extraction in ingestion
        if (title.includes('traffic') || title.includes('delay') || title.includes('jam') || title.includes('congestion')) {
          traffic.push(entity);
        } else if (title.includes('weather') || title.includes('storm') || title.includes('rain') || title.includes('snow')) {
          weather.push(entity);
        } else {
          other.push(entity);
        }
      }
    }
  }

  return { traffic, weather, other };
}

/**
 * Finds appointments that share a location or person with a given entity
 */
function findRelatedAppointments(graph: ContextGraph, entity: ContextEntity): ContextEntity[] {
  const appointments: ContextEntity[] = [];
  const relations = graph.getRelations();
  
  // Find appointments linked through location or person
  for (const rel of relations) {
    if (rel.sourceId === entity.id || rel.targetId === entity.id) {
      const otherId = rel.sourceId === entity.id ? rel.targetId : rel.sourceId;
      const other = graph.getEntities().find(e => e.id === otherId);
      
      if (other && other.type === 'Event' && (other.properties as any).iso) {
        appointments.push(other);
      }
    }
  }
  
  // Also find appointments sharing same person or place
  const props = entity.properties as any;
  if (props.person || props.place) {
    const allEntities = graph.getEntities();
    for (const ent of allEntities) {
      if (ent.type === 'Event' && (ent.properties as any).iso) {
        const entProps = ent.properties as any;
        if ((props.person && entProps.person === props.person) ||
            (props.place && entProps.place === props.place)) {
          if (!appointments.find(a => a.id === ent.id)) {
            appointments.push(ent);
          }
        }
      }
    }
  }
  
  return appointments;
}

export function analyzeDependencies(graph: ContextGraph, state: SensorState) {
  const now = new Date();
  const ents = graph.getEntities();

  // Find upcoming appointments within next 24 hours
  const upcoming = ents
    .filter((e) => e.type === "Event" && e.properties && (e.properties as any).iso)
    .map((e) => ({
      entity: e,
      iso: (e.properties as any).iso,
    }))
    .filter((x) => {
      try {
        const d = new Date(x.iso);
        const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
        return diff >= 0 && diff <= 24;
      } catch (e) {
        return false;
      }
    });

  const isLeaving = (state.motionState === "walking" || state.motionState === "driving" || state.motionState === "transit");

  // Priority 1: Check appointments with requirements when user is leaving
  for (const up of upcoming) {
    const appt = up.entity;
    const relations = graph.getRelations();
    const reqs = relations.filter((r) => r.sourceId === appt.id && r.type === "REQUIRES");
    const relatedEventIds = new Set(
      relations
        .filter((r) => r.sourceId === appt.id && ["RELATED_TO", "DEPENDS_ON"].includes(r.type))
        .map((r) => r.targetId)
    );

    const dueIso = String((appt.properties as any).iso || (appt.properties as any).time || "");
    const dueSoon = Math.max(0, (new Date(dueIso).getTime() - now.getTime()) / (1000 * 60 * 60));

    // HIGH PRIORITY: Check if requirements are satisfied when leaving
    if (reqs.length && isLeaving && dueSoon <= 24) {
      // Check if requirements are critical (documents, medical items, etc.)
      // vs routine items (workout clothes, groceries, general supplies)
      const criticalRequirements = reqs.filter((r) => {
        const target = ents.find((e) => e.id === r.targetId);
        if (!target) return false;
        
        const title = String(target.title).toLowerCase();
        
        // Critical: legal/medical/official documents, tickets, important items
        const isCritical = /insurance|passport|license|id card|certificate|document|form|paperwork|application|records|ticket|confirmation|registration|contract|statement|report|prescription/.test(title);
        
        // Routine: clothes, food, general supplies that don't require specific intervention
        const isRoutine = /workout clothes|gym clothes|clothes|supplies|food|groceries|milk|bread/.test(title);
        
        return isCritical && !isRoutine;
      });
      
      // Only intervene if there are critical requirements
      if (criticalRequirements.length > 0) {
        const requiredTitles = criticalRequirements
          .map((r) => {
            const target = ents.find((e) => e.id === r.targetId);
            return target ? String(target.title) : null;
          })
          .filter(Boolean)
          .join(" and ") || "needed items";
        
        const person = (appt.properties && (appt.properties as any).person) || "someone";
        const place = (appt.properties && (appt.properties as any).place) || "the appointment";
        const msg = `Before you leave for ${person}'s appointment at ${place}, take ${requiredTitles}.`;
        
        return { forceIntervention: true, message: msg, appointmentId: appt.id, reason: "requirements_check" };
      }
    }

    // MEDIUM PRIORITY: Time-proximity interventions (30-120 min before)
    // Trigger even if user is not leaving yet, BUT only for scenarios that require bringing critical items
    // Do NOT trigger for: home-based appointments, routine activities, or informational reminders
    if (reqs.length && dueSoon > 0 && dueSoon <= 2 && !isLeaving) {
      const minutesUntil = Math.round(dueSoon * 60);
      
      // Only intervene if within preparation window (30-120 minutes)
      if (minutesUntil >= 30 && minutesUntil <= 120) {
        const place = (appt.properties && (appt.properties as any).place) || "";
        const placeLower = String(place).toLowerCase();
        
        // Skip interventions for home-based scenarios (deliveries, repairs)
        const isHomeBasedScenario = placeLower === "home" || 
                                     /at home|delivery|repair|pickup at/.test(String(place));
        
        // Check if requirements are critical vs routine
        const criticalRequirements = reqs.filter((r) => {
          const target = ents.find((e) => e.id === r.targetId);
          if (!target) return false;
          
          const title = String(target.title).toLowerCase();
          const isCritical = /insurance|passport|license|id card|certificate|document|form|paperwork|application|records|ticket|confirmation|registration|contract|statement|report|prescription/.test(title);
          const isRoutine = /workout clothes|gym clothes|clothes|supplies|food|groceries/.test(title);
          
          return isCritical && !isRoutine;
        });
        
        if (!isHomeBasedScenario && criticalRequirements.length > 0) {
          const requiredTitles = criticalRequirements
            .map((r) => {
              const target = ents.find((e) => e.id === r.targetId);
              return target ? String(target.title) : null;
            })
            .filter(Boolean)
            .join(" and ") || "needed items";
          
          const person = (appt.properties && (appt.properties as any).person) || "someone";
          const timeDesc = minutesUntil < 60 ? `in ${minutesUntil} minutes` : `in ${Math.round(dueSoon)} hours`;
          
          const msg = `${person}'s appointment at ${place} is ${timeDesc}. Remember to bring ${requiredTitles}.`;
          
          return { 
            forceIntervention: true, 
            message: msg, 
            appointmentId: appt.id, 
            reason: "time_proximity_preparation" 
          };
        }
      }
    }

    // If appointment has requirements but user is not leaving yet, establish dependencies for planning
    if (reqs.length && dueSoon <= 24 && !isLeaving) {
      for (const req of reqs) {
        if (!relatedEventIds.has(req.targetId)) {
          graph.addRelation({
            id: `rel:${appt.id}:${req.targetId}:depends`,
            sourceId: appt.id,
            targetId: req.targetId,
            type: "DEPENDS_ON",
            confidence: 0.75,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Priority 2: Check for external factors affecting upcoming appointments
  const externalFactors = identifyExternalFactors(ents);
  
  // Process traffic-related factors
  for (const trafficEntity of externalFactors.traffic) {
    const affectedAppointments = findRelatedAppointments(graph, trafficEntity);
    
    for (const appt of affectedAppointments) {
      const dueIso = String((appt.properties as any).iso || "");
      try {
        const dueSoon = Math.max(0, (new Date(dueIso).getTime() - now.getTime()) / (1000 * 60 * 60));
        
        if (dueSoon <= 24 && isLeaving) {
          // Establish relationship in graph
          const relId = `rel:${appt.id}:${trafficEntity.id}:related`;
          const relations = graph.getRelations();
          if (!relations.find(r => r.id === relId)) {
            graph.addRelation({
              id: relId,
              sourceId: appt.id,
              targetId: trafficEntity.id,
              type: "RELATED_TO",
              confidence: 0.75,
              createdAt: new Date().toISOString(),
            });
          }
          
          const person = (appt.properties as any).person || "someone";
          const place = (appt.properties as any).place || "the appointment location";
          const msg = `Traffic looks heavy; consider leaving earlier for ${person}'s appointment at ${place}.`;
          
          return { forceIntervention: true, message: msg, appointmentId: appt.id, reason: "traffic_impact" };
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  // Process weather-related factors
  for (const weatherEntity of externalFactors.weather) {
    const affectedAppointments = findRelatedAppointments(graph, weatherEntity);
    
    for (const appt of affectedAppointments) {
      const dueIso = String((appt.properties as any).iso || "");
      try {
        const dueSoon = Math.max(0, (new Date(dueIso).getTime() - now.getTime()) / (1000 * 60 * 60));
        
        if (dueSoon <= 24 && isLeaving) {
          // Establish relationship in graph
          const relId = `rel:${appt.id}:${weatherEntity.id}:related`;
          const relations = graph.getRelations();
          if (!relations.find(r => r.id === relId)) {
            graph.addRelation({
              id: relId,
              sourceId: appt.id,
              targetId: weatherEntity.id,
              type: "RELATED_TO",
              confidence: 0.75,
              createdAt: new Date().toISOString(),
            });
          }
          
          const person = (appt.properties as any).person || "someone";
          const place = (appt.properties as any).place || "the appointment location";
          const msg = `Weather may affect travel; leave earlier for ${person}'s appointment at ${place}.`;
          
          return { forceIntervention: true, message: msg, appointmentId: appt.id, reason: "weather_impact" };
        }
      } catch (e) {
        continue;
      }
    }
  }

  return { forceIntervention: false };
}

export default { analyzeDependencies };
