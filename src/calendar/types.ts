/**
 * Calendar Intelligence Types
 * 
 * Core data models for normalized calendar events and enriched intelligence
 */

export enum CalendarSource {
  GOOGLE = 'GOOGLE',
  OUTLOOK = 'OUTLOOK',
  APPLE = 'APPLE',
  ANDROID = 'ANDROID',
  MANUAL = 'MANUAL'
}

export enum EventStatus {
  CONFIRMED = 'CONFIRMED',
  TENTATIVE = 'TENTATIVE',
  CANCELLED = 'CANCELLED'
}

export enum EventVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  CONFIDENTIAL = 'CONFIDENTIAL'
}

export enum EventType {
  WORK_MEETING = 'WORK_MEETING',
  PERSONAL_MEETING = 'PERSONAL_MEETING',
  MEDICAL_APPOINTMENT = 'MEDICAL_APPOINTMENT',
  EDUCATION = 'EDUCATION',
  EXAM = 'EXAM',
  TRAVEL = 'TRAVEL',
  FLIGHT = 'FLIGHT',
  TRAIN = 'TRAIN',
  BUS = 'BUS',
  RESTAURANT = 'RESTAURANT',
  SHOPPING = 'SHOPPING',
  DELIVERY = 'DELIVERY',
  BANKING = 'BANKING',
  GOVERNMENT = 'GOVERNMENT',
  LEGAL = 'LEGAL',
  FAMILY = 'FAMILY',
  BIRTHDAY = 'BIRTHDAY',
  ANNIVERSARY = 'ANNIVERSARY',
  SPORT = 'SPORT',
  EXERCISE = 'EXERCISE',
  OTHER = 'OTHER'
}

export enum ConflictType {
  TEMPORAL_CONFLICT = 'TEMPORAL_CONFLICT',
  TRAVEL_CONFLICT = 'TRAVEL_CONFLICT',
  PREPARATION_CONFLICT = 'PREPARATION_CONFLICT',
  LOCATION_CONFLICT = 'LOCATION_CONFLICT',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  PERSON_CONFLICT = 'PERSON_CONFLICT',
  ENERGY_CONFLICT = 'ENERGY_CONFLICT'
}

export enum ConflictSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum TransportMode {
  CAR = 'CAR',
  BUS = 'BUS',
  TRAIN = 'TRAIN',
  WALK = 'WALK',
  BIKE = 'BIKE',
  FLIGHT = 'FLIGHT',
  UNKNOWN = 'UNKNOWN'
}

export interface RawLocation {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface PersonReference {
  name?: string;
  email?: string;
  phone?: string;
}

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string;
  byDay?: string[];
}

export interface Reminder {
  minutes: number;
  method: 'EMAIL' | 'NOTIFICATION' | 'SMS';
}

/**
 * Normalized Calendar Event
 * Raw calendar event from any source, normalized to common format
 */
export interface LifeCalendarEvent {
  id: string;
  source: CalendarSource;
  sourceEventId: string;
  
  title?: string;
  description?: string;
  
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  
  timezone?: string;
  
  location?: RawLocation;
  
  organizer?: PersonReference;
  attendees: PersonReference[];
  
  recurrence?: RecurrenceRule;
  
  status: EventStatus;
  visibility: EventVisibility;
  
  reminders: Reminder[];
  
  createdAt: string;
  updatedAt: string;
  syncState: 'NEW' | 'UPDATED' | 'DELETED';
}

/**
 * Resolved Person Entity
 */
export interface ResolvedPerson {
  personId: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  relationship?: string;
  confidence: number; // 0-1
}

/**
 * Resolved Place Entity
 */
export interface ResolvedPlace {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  placeType: string;
  semanticLabel?: string; // e.g., "Home", "Office", "Gym"
  confidence: number; // 0-1
}

/**
 * Resolved Organization Entity
 */
export interface ResolvedOrganization {
  organizationId: string;
  name: string;
  domain?: string;
  type?: string;
  confidence: number;
}

/**
 * Travel Requirement
 */
export interface TravelRequirement {
  required: boolean;
  origin?: ResolvedPlace;
  destination: ResolvedPlace;
  mode: TransportMode;
  modeConfidence: number;
  
  distanceKm: number;
  estimatedDurationMin: number;
  historicalDurationMin?: number;
  
  bufferMin: number;
  accessTimeMin: number; // Time to access place (parking, security, etc.)
  
  requiredDurationMin: number; // Total time needed
  requiredDepartureTime: string; // ISO 8601
  
  confidence: number;
}

/**
 * Document Requirement
 */
export interface DocumentRequirement {
  type: string;
  name: string;
  required: boolean;
  confidence: number;
  available: boolean;
  documentId?: string;
}

/**
 * Preparation Plan
 */
export interface PreparationPlan {
  required: boolean;
  estimatedMinutes: number;
  items: PreparationItem[];
}

export interface PreparationItem {
  type: 'DOCUMENT' | 'TASK' | 'TRAVEL' | 'RESOURCE';
  description: string;
  deadline?: string; // ISO 8601
  completed: boolean;
  confidence: number;
}

/**
 * Schedule Conflict
 */
export interface ScheduleConflict {
  conflictId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  confidence: number;
  
  event1Id: string;
  event2Id?: string;
  
  description: string;
  reason: string;
  
  resolutionOptions: ConflictResolution[];
}

/**
 * Conflict Resolution Option
 */
export interface ConflictResolution {
  resolutionId: string;
  type: 'MOVE_EVENT' | 'CANCEL_EVENT' | 'REMOTE_ATTEND' | 'ADJUST_TIME' | 'NOTIFY_ORGANIZER';
  description: string;
  feasibility: number; // 0-1
  impact: number; // 0-1
}

/**
 * Importance Score
 */
export interface ImportanceScore {
  score: number; // 0-1
  factors: {
    attendeeImportance: number;
    eventType: number;
    userHistory: number;
    deadline: number;
  };
}

/**
 * Event Flexibility Score
 */
export interface FlexibilityScore {
  score: number; // 0-1 (0 = inflexible, 1 = very flexible)
  factors: {
    eventType: number;
    historicalRescheduling: number;
    attendeeFlexibility: number;
    timeUntilEvent: number;
  };
}

/**
 * Enriched Calendar Event
 * Calendar event with all resolved intelligence
 */
export interface EnrichedCalendarEvent {
  event: LifeCalendarEvent;
  
  // Classification
  eventType?: EventType;
  eventTypeConfidence?: number;
  
  // Resolved Entities
  people: ResolvedPerson[];
  place?: ResolvedPlace;
  organization?: ResolvedOrganization;
  
  // Intelligence
  travelRequirement?: TravelRequirement;
  preparation?: PreparationPlan;
  requiredDocuments: DocumentRequirement[];
  
  // Analysis
  conflicts: ScheduleConflict[];
  importance: ImportanceScore;
  flexibility: FlexibilityScore;
  
  // Predictions
  predictedDurationMin?: number; // Based on historical data
  actualStartTime?: string; // When event actually started (historical)
  actualEndTime?: string;   // When event actually ended (historical)
  
  // Enrichment metadata
  enrichedAt: string;
  enrichmentVersion: string;
}

/**
 * Schedule Window
 * Temporal window including travel and preparation time
 */
export interface ScheduleWindow {
  eventId: string;
  
  // Core event time
  eventStart: string;
  eventEnd: string;
  
  // Extended window
  windowStart: string; // Including travel and preparation
  windowEnd: string;
  
  // Components
  preparationStart?: string;
  travelStart?: string;
  eventActualStart: string;
  eventActualEnd: string;
  travelEnd?: string;
}

/**
 * Schedule Feasibility
 */
export interface ScheduleFeasibility {
  date: string; // YYYY-MM-DD
  score: number; // 0-1
  
  events: string[]; // Event IDs
  conflicts: ScheduleConflict[];
  
  warnings: ScheduleWarning[];
  
  analysis: {
    totalEvents: number;
    totalConflicts: number;
    totalTravelTimeMin: number;
    totalPreparationMin: number;
    availableBufferMin: number;
  };
}

export interface ScheduleWarning {
  type: 'TIGHT_TRANSITION' | 'MISSING_PREPARATION' | 'TRAVEL_RISK' | 'INSUFFICIENT_BUFFER';
  severity: ConflictSeverity;
  description: string;
  eventIds: string[];
}

/**
 * Place Preparation Profile
 */
export interface PlacePreparationProfile {
  placeType: string;
  arrivalBufferMin: number;
  accessTimeMin: number;
  parkingTimeMin?: number;
  securityTimeMin?: number;
  checkInTimeMin?: number;
}

/**
 * Event Type Preparation Profile
 */
export interface EventTypeProfile {
  eventType: EventType;
  travelLikelihood: number; // 0-1
  preparationLikelihood: number; // 0-1
  documentLikelihood: number; // 0-1
  typicalDurationMin: number;
  defaultImportance: number;
  defaultFlexibility: number;
}

/**
 * Historical Event Data
 */
export interface HistoricalEventData {
  eventId: string;
  scheduledDurationMin: number;
  actualDurationMin: number;
  scheduledStartTime: string;
  actualStartTime: string;
  wasRescheduled: boolean;
  wasCancelled: boolean;
}

/**
 * Travel History
 */
export interface TravelHistory {
  routeId: string;
  origin: ResolvedPlace;
  destination: ResolvedPlace;
  mode: TransportMode;
  
  observations: TravelObservation[];
  
  averageDurationMin: number;
  medianDurationMin: number;
  minDurationMin: number;
  maxDurationMin: number;
}

export interface TravelObservation {
  timestamp: string;
  durationMin: number;
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  conditions?: string; // weather, traffic
}
