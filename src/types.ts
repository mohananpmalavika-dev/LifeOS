export type EntityType =
  | "Person"
  | "Place"
  | "Task"
  | "Event"
  | "Commitment"
  | "Document"
  | "Object"
  | "Preference"
  | "Transaction"
  | "HealthSignal"
  | "TravelPlan";

export type RelationType =
  | "OWNS"
  | "KNOWS"
  | "WORKS_WITH"
  | "LOCATED_AT"
  | "MENTIONED_IN"
  | "RELATED_TO"
  | "REQUIRES"
  | "DEPENDS_ON"
  | "CONFLICTS_WITH"
  | "EXPIRES_AT"
  | "PURCHASED"
  | "PLANNED_FOR";

export interface ContextEntity {
  id: string;
  type: EntityType;
  title: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContextRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  confidence: number;
  createdAt: string;
}

export type EventSource =
  | "notification"
  | "calendar"
  | "location"
  | "photo"
  | "voice"
  | "sensor"
  | "external";

export interface RawEvent {
  id: string;
  type: string;
  source: EventSource;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface EventHistoryMetadata {
  shown?: number;
  accepted?: number;
}

export interface NormalizedEventMetadata {
  text?: string;
  sender?: string;
  threadId?: string;
  history?: EventHistoryMetadata;
  [key: string]: unknown;
}

export interface NormalizedEvent {
  id: string;
  event: string;
  source: EventSource;
  timestamp: string;
  entities: string[];
  metadata: NormalizedEventMetadata;
  confidence: number;
}

export interface Embedding {
  values: number[];
}

export interface VectorRecord {
  id: string;
  content: string;
  embedding: Embedding;
  metadata: Record<string, unknown>;
  insertedAt: string;
}

export type FocusState = "focused" | "distracted" | "idle" | "offline";
export type MotionState = "stationary" | "walking" | "driving" | "transit";

export interface LocationState {
  latitude?: number;
  longitude?: number;
  placeLabel?: string;
  geofence?: string;
}

export interface SensorState {
  batteryLevel: number;
  focusState: FocusState;
  motionState: MotionState;
  location: LocationState;
  ambientSoundLevel?: number;
  lastUpdated: string;
}

export interface DecisionProfile {
  importance: number;
  urgency: number;
  confidence: number;
  interruptionCost: number;
}

export interface ConfidenceWeights {
  pIntent: number;
  cState: number;
  aHistorical: number;
  eUrgency: number;
}

export interface PenaltyFactors {
  interruptibility: number;
  locationAccuracy: number;
  cooldown: number;
}

export interface InterventionConfidence {
  baseScore: number;
  finalScore: number;
  weights: ConfidenceWeights;
  penalties: PenaltyFactors;
}

export interface ActionSurface {
  type: "notification" | "widget" | "haptic" | "auto_draft";
  title: string;
  description: string;
  trigger: string;
}

export interface Intervention {
  id: string;
  title: string;
  summary: string;
  score: number;
  reason: string;
  surfaces: ActionSurface[];
  createdAt: string;
}
