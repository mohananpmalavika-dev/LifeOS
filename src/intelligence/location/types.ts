/**
 * Location Intelligence Types
 * 
 * Domain model for Location Intelligence - transforms raw GPS coordinates
 * into meaningful life context including places, movements, and routines.
 */

// ============================================================================
// Core Geographic Types
// ============================================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPosition extends GeoPoint {
  accuracyMeters: number;
  timestamp: Date;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

// ============================================================================
// Place Types
// ============================================================================

export enum PlaceType {
  HOME = 'HOME',
  WORK = 'WORK',
  SCHOOL = 'SCHOOL',
  GYM = 'GYM',
  HOSPITAL = 'HOSPITAL',
  RESTAURANT = 'RESTAURANT',
  SHOP = 'SHOP',
  AIRPORT = 'AIRPORT',
  TRANSIT = 'TRANSIT',
  ENTERTAINMENT = 'ENTERTAINMENT',
  RELIGIOUS = 'RELIGIOUS',
  UNKNOWN = 'UNKNOWN',
}

export interface PlaceContext {
  placeId: string;
  name?: string;
  type: PlaceType;
  latitude: number;
  longitude: number;
  confidence: number;
}

export interface LearnedPlace {
  id: string;
  center: GeoPoint;
  radiusMeters: number;
  
  visitCount: number;
  totalDwellMinutes: number;
  
  firstSeen: Date;
  lastSeen: Date;
  
  timeDistribution: TimeDistribution;
  dayDistribution: DayDistribution;
  
  semanticType?: PlaceType;
  name?: string;
  confidence: number;
  
  // For privacy
  isPrivate: boolean;
}

export interface TimeDistribution {
  // Hourly distribution [0-23]
  hourlyVisits: number[];
  
  // Categorized times
  morning: number;    // 6-12
  afternoon: number;  // 12-18
  evening: number;    // 18-22
  night: number;      // 22-6
}

export interface DayDistribution {
  // Weekly distribution [0=Sunday, 6=Saturday]
  weeklyVisits: number[];
  
  // Categorized days
  weekday: number;
  weekend: number;
}

// ============================================================================
// Movement Types
// ============================================================================

export enum MovementType {
  STATIONARY = 'STATIONARY',
  WALKING = 'WALKING',
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  DRIVING = 'DRIVING',
  IN_VEHICLE = 'IN_VEHICLE',
  TRANSIT = 'TRANSIT',
  UNKNOWN = 'UNKNOWN',
}

export enum TravelMode {
  WALKING = 'WALKING',
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  CAR = 'CAR',
  BUS = 'BUS',
  TRAIN = 'TRAIN',
  TAXI = 'TAXI',
  AIRPLANE = 'AIRPLANE',
  UNKNOWN = 'UNKNOWN',
}

export interface MovementState {
  state: MovementType;
  speedKmh?: number;
  heading?: number;
  confidence: number;
  timestamp: Date;
}

// ============================================================================
// Location State Machine
// ============================================================================

export enum LocationState {
  STATIONARY_AT_PLACE = 'STATIONARY_AT_PLACE',
  POSSIBLE_DEPARTURE = 'POSSIBLE_DEPARTURE',
  DEPARTED = 'DEPARTED',
  TRAVELING = 'TRAVELING',
  APPROACHING_DESTINATION = 'APPROACHING_DESTINATION',
  POSSIBLE_ARRIVAL = 'POSSIBLE_ARRIVAL',
  ARRIVED = 'ARRIVED',
  DWELLING = 'DWELLING',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// Movement Intent
// ============================================================================

export enum MovementIntent {
  COMMUTING_TO_WORK = 'COMMUTING_TO_WORK',
  GOING_HOME = 'GOING_HOME',
  GOING_TO_APPOINTMENT = 'GOING_TO_APPOINTMENT',
  SHOPPING = 'SHOPPING',
  EXERCISING = 'EXERCISING',
  TRAVELING = 'TRAVELING',
  LEISURE = 'LEISURE',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// Context Types
// ============================================================================

export interface LocationContext {
  timestamp: Date;
  
  // Places
  currentPlace?: PlaceContext;
  previousPlace?: PlaceContext;
  destination?: PlaceContext;
  
  // Movement
  travelMode: TravelMode;
  movementState: MovementState;
  locationState: LocationState;
  
  // Timing
  dwellTime?: number; // minutes
  arrivalProbability: number;
  departureProbability: number;
  
  // Patterns
  routinePattern?: RoutinePattern;
  movementIntent?: MovementIntent;
  
  // Overall confidence
  confidence: number;
}

export interface DestinationCandidate {
  place: PlaceContext;
  probability: number;
  reason: string;
  sources: DestinationSource[];
}

export enum DestinationSource {
  CALENDAR = 'CALENDAR',
  ROUTINE = 'ROUTINE',
  HEADING = 'HEADING',
  RECENT_BEHAVIOR = 'RECENT_BEHAVIOR',
  EXPLICIT = 'EXPLICIT',
}

// ============================================================================
// Historical Types
// ============================================================================

export interface PlaceVisit {
  visitId: string;
  placeId: string;
  
  arrivalTime: Date;
  departureTime?: Date;
  
  durationMinutes?: number;
  
  arrivalConfidence: number;
  departureConfidence?: number;
  
  travelMode?: TravelMode;
  
  // Context at time of visit
  calendarEvents?: string[];
  dayOfWeek: number;
  hourOfDay: number;
}

export interface PlaceTransition {
  transitionId: string;
  
  fromPlaceId?: string;
  toPlaceId?: string;
  
  departureTime: Date;
  arrivalTime: Date;
  
  durationMinutes: number;
  distanceKm?: number;
  
  travelMode?: TravelMode;
  confidence: number;
  
  // Route characteristics
  averageSpeed?: number;
  maxSpeed?: number;
}

// ============================================================================
// Routine Types
// ============================================================================

export interface RoutinePattern {
  patternId: string;
  name: string;
  type: RoutineType;
  
  // Timing
  dayPattern: DayPattern;
  timeWindow: TimeWindow;
  
  // Places
  fromPlace?: string;
  toPlace?: string;
  
  // Characteristics
  typicalDuration?: number;
  typicalTravelMode?: TravelMode;
  
  // Frequency
  occurrences: number;
  lastOccurrence: Date;
  
  // Confidence
  probability: number;
}

export enum RoutineType {
  WORKDAY_COMMUTE = 'WORKDAY_COMMUTE',
  MORNING_ROUTINE = 'MORNING_ROUTINE',
  EVENING_ROUTINE = 'EVENING_ROUTINE',
  WEEKEND_ACTIVITY = 'WEEKEND_ACTIVITY',
  WEEKLY_APPOINTMENT = 'WEEKLY_APPOINTMENT',
  CUSTOM = 'CUSTOM',
}

export interface DayPattern {
  daysOfWeek: number[]; // 0=Sunday
  excludeHolidays?: boolean;
}

export interface TimeWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  flexibilityMinutes: number;
}

// ============================================================================
// Location Signals (Abstraction Layer)
// ============================================================================

export type LocationSignal = 
  | PositionSignal
  | ActivitySignal
  | WifiSignal
  | BluetoothSignal
  | GeofenceSignal;

export interface PositionSignal {
  type: 'POSITION';
  position: GeoPosition;
}

export interface ActivitySignal {
  type: 'ACTIVITY';
  activity: MovementType;
  confidence: number;
  timestamp: Date;
}

export interface WifiSignal {
  type: 'WIFI';
  fingerprint: string;
  networks: string[];
  timestamp: Date;
}

export interface BluetoothSignal {
  type: 'BLUETOOTH';
  devices: string[];
  knownDevices: string[];
  timestamp: Date;
}

export interface GeofenceSignal {
  type: 'GEOFENCE';
  placeId: string;
  event: 'ENTER' | 'EXIT' | 'DWELL';
  timestamp: Date;
}

// ============================================================================
// Policy Types
// ============================================================================

export enum LocationSamplingPolicy {
  LOW_POWER = 'LOW_POWER',           // Stationary at known place
  NORMAL = 'NORMAL',                 // Regular movement
  HIGH_ACCURACY = 'HIGH_ACCURACY',   // Approaching destination
  GEOFENCE_ONLY = 'GEOFENCE_ONLY',  // Use geofences only
}

export interface LocationPolicy {
  samplingPolicy: LocationSamplingPolicy;
  intervalSeconds: number;
  accuracyMeters: number;
  
  privacyMode: PrivacyMode;
  rawLocationRetention: number; // days
  shareRawLocation: boolean;
}

export enum PrivacyMode {
  PRIVATE = 'PRIVATE',           // Local only, semantic context only
  BALANCED = 'BALANCED',         // Short retention, selected samples
  ADVANCED = 'ADVANCED',         // Full sync allowed
}

// ============================================================================
// Event Types
// ============================================================================

export enum LocationEventType {
  PLACE_ARRIVAL = 'PLACE_ARRIVAL',
  PLACE_DEPARTURE = 'PLACE_DEPARTURE',
  PLACE_DWELL = 'PLACE_DWELL',
  TRAVEL_STARTED = 'TRAVEL_STARTED',
  TRAVEL_ENDED = 'TRAVEL_ENDED',
  DESTINATION_INFERRED = 'DESTINATION_INFERRED',
  ROUTINE_DEVIATION = 'ROUTINE_DEVIATION',
  COMMUTE_STARTED = 'COMMUTE_STARTED',
  COMMUTE_COMPLETED = 'COMMUTE_COMPLETED',
  APPROACHING_DESTINATION = 'APPROACHING_DESTINATION',
  NEW_PLACE_DISCOVERED = 'NEW_PLACE_DISCOVERED',
}

export interface LocationEvent {
  type: LocationEventType;
  timestamp: Date;
  data: any;
  confidence: number;
}

// ============================================================================
// Configuration
// ============================================================================

export interface LocationConfig {
  // Place clustering
  placeClusteringRadiusMeters: number;
  minimumDwellMinutes: number;
  minimumVisitsForPlace: number;
  
  // State machine hysteresis
  arrivalStabilitySeconds: number;
  departureStabilitySeconds: number;
  
  // Geofencing
  defaultGeofenceRadiusMeters: number;
  geofenceRadiusMultiplier: number;
  
  // Routine learning
  minimumOccurrencesForRoutine: number;
  routineTimeFlexibilityMinutes: number;
  
  // Destination prediction
  destinationPredictionThreshold: number;
  approachingDistanceMeters: number;
  
  // Privacy
  defaultPrivacyMode: PrivacyMode;
  rawLocationRetentionDays: number;
}

export const DEFAULT_LOCATION_CONFIG: LocationConfig = {
  placeClusteringRadiusMeters: 100,
  minimumDwellMinutes: 5,
  minimumVisitsForPlace: 3,
  
  arrivalStabilitySeconds: 120,
  departureStabilitySeconds: 90,
  
  defaultGeofenceRadiusMeters: 150,
  geofenceRadiusMultiplier: 1.5,
  
  minimumOccurrencesForRoutine: 5,
  routineTimeFlexibilityMinutes: 30,
  
  destinationPredictionThreshold: 0.7,
  approachingDistanceMeters: 1000,
  
  defaultPrivacyMode: PrivacyMode.PRIVATE,
  rawLocationRetentionDays: 7,
};
