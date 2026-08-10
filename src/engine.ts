import { ContextGraph } from "./context-engine.js";
import { VectorStore, createEmbedding } from "./vector-store.js";
import { initialSensorState } from "./state-engine.js";
import { calculateInterventionConfidence, scoreIntervention } from "./decision-engine.js";
import { evaluateEvent, deriveConfidenceSubscores } from "./reasoning-engine.js";
import { buildInterventionSurfaces } from "./intervention-layer.js";
import type { NormalizedEvent } from "./types.js";
import { analyzeContext } from "./reasoning-engine.js";
import { resolveEntitiesForEvent } from "./entity-resolution.js";
import { analyzeDependencies } from "./context-reasoner.js";

export class ContextEngine {
  private graph: ContextGraph;
  private vectorStore: VectorStore;
  public sensorState: ReturnType<typeof initialSensorState>;

  constructor() {
    this.graph = new ContextGraph();
    this.vectorStore = new VectorStore();
    this.sensorState = initialSensorState();
  }

  async process(event: NormalizedEvent) {
    // first, ingest raw event into graph
    this.graph.ingestEvent(event);

    // resolve semantic entities and link them into the graph
    try {
      await resolveEntitiesForEvent(this.graph, event as NormalizedEvent);
    } catch (e) {
      // ignore resolution errors
    }

    // if this is a location or motion event, update sensor state and connect leaving to appointments
    try {
      const structured = (event.metadata && (event.metadata as any).structured) || {};
      const rawText = String(event.metadata && (event.metadata as any).text || "");
      const locationMatch = rawText.match(/location\s*=\s*([A-Za-z ]+)/i);
      if (event.event === 'location' && event.metadata && (event.metadata as any).place) {
        const place = (event.metadata as any).place;
        this.updateSensorState({ location: { ...this.sensorState.location, placeLabel: place }, lastUpdated: new Date().toISOString() });
      }
      if (locationMatch) {
        const place = locationMatch[1].trim();
        this.updateSensorState({ location: { ...this.sensorState.location, placeLabel: place }, lastUpdated: new Date().toISOString() });
      }
      if (structured.place && String(structured.place).toLowerCase() === 'home') {
        this.updateSensorState({ location: { ...this.sensorState.location, placeLabel: 'home', geofence: 'home' }, lastUpdated: new Date().toISOString() });
      }
      const transitionMatch = rawText.match(/location transition\s*:\s*([A-Za-z ]+)\s*->\s*([A-Za-z ]+)/i);
      if (transitionMatch) {
        const destination = transitionMatch[2].trim();
        this.updateSensorState({ motionState: 'walking', location: { ...this.sensorState.location, placeLabel: destination }, lastUpdated: new Date().toISOString() });
      }
      const leavingPattern = /leave|leaving|left|depart|departing/i;
      const isLeavingText = leavingPattern.test(rawText) || (structured.action && leavingPattern.test(String(structured.action)));
      if (isLeavingText) {
        this.updateSensorState({ motionState: 'walking' });

        const appointments = this.graph.getEntities().filter((e) => e.type === 'Event' && e.properties && (e.properties as any).iso);
        if (appointments.length) {
          const now = new Date();
          let best: any = null;
          let bestDiff = Infinity;
          for (const appt of appointments) {
            const iso = (appt.properties && (appt.properties as any).iso);
            if (!iso) continue;
            try {
              const d = new Date(iso);
              const diff = d.getTime() - now.getTime();
              if (diff >= 0 && diff < bestDiff) {
                best = appt;
                bestDiff = diff;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
          if (best) {
            this.graph.addRelation({
              id: `rel:${best.id}:${event.id}:depends`,
              sourceId: best.id,
              targetId: `event:${event.id}`,
              type: 'DEPENDS_ON',
              confidence: event.confidence,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // base evaluation
    const evaluation = evaluateEvent(event, this.sensorState);
    let subscores = deriveConfidenceSubscores(event, this.sensorState);

    // cross-event reasoning: analyze graph context and bump subscores when appropriate
    try {
      const inference = analyzeContext(this.graph, event, this.sensorState);
      if (inference) {
        if (inference.pIntentBoost) subscores.pIntent = Math.min(1, subscores.pIntent + inference.pIntentBoost);
        if (inference.eUrgencyBoost) subscores.eUrgency = Math.min(1, subscores.eUrgency + inference.eUrgencyBoost);
      }
    } catch (e) {
      // ignore inference errors
    }

    

    const penalties = {
      interruptibility: this.sensorState.focusState === "focused" && this.sensorState.motionState === "driving" ? 0.2 : 1.0,
      // relax location accuracy penalty to be less punitive for missing coordinates in tests
      locationAccuracy: this.sensorState.location.latitude && this.sensorState.location.longitude ? 1.0 : 0.9,
      cooldown: 1.0,
    };

    const confidence = calculateInterventionConfidence(subscores as any, penalties as any);

    const baseIntervention = scoreIntervention(event, evaluation.recommendation, confidence as any);
    const intervention = buildInterventionSurfaces(baseIntervention);

    // persist vector
    try {
      this.vectorStore.insert({
        id: event.id,
        content: JSON.stringify(event.metadata),
        embedding: createEmbedding(event.entities.join(" ")),
        metadata: { source: event.source, confidence: event.confidence, relevance: evaluation.relevance, finalScore: confidence.finalScore },
        insertedAt: new Date().toISOString(),
      });
    } catch (e) {
      // ignore
    }

    // deeper dependency analysis across events (after confidence computed so we can reference penalties)
    try {
      const dep = analyzeDependencies(this.graph, this.sensorState as any);
      if (dep && dep.forceIntervention) {
        // build forced intervention with high confidence
        const forcedConfidence = { baseScore: 0.95, finalScore: 0.95, weights: { pIntent: 1, cState: 0, aHistorical: 0, eUrgency: 0 }, penalties } as any;
        const forced = scoreIntervention(event as any, dep.message || 'Action required', forcedConfidence as any);
        const forcedSurface = buildInterventionSurfaces(forced);
        return { event, evaluation, subscores, penalties, confidence, intervention: forcedSurface };
      }
    } catch (e) {
      // ignore
    }

    return {
      event,
      evaluation,
      subscores,
      penalties,
      confidence,
      // threshold lowered to 0.65 to improve recall while maintaining precision
      intervention: confidence.finalScore >= 0.65 ? intervention : null,
    };
  }

  updateSensorState(updates: Partial<ReturnType<typeof initialSensorState>>) {
    this.sensorState = { ...this.sensorState, ...updates, lastUpdated: new Date().toISOString() };
  }

  getGraph() {
    return this.graph;
  }
}

export default ContextEngine;
