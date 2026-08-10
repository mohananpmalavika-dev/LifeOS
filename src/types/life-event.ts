/**
 * Universal LifeEvent Type System
 * 
 * This defines the canonical event structure that all collectors (Android, iOS, Web, etc.)
 * must eventually produce. The backend reasoning engine operates exclusively on LifeEvents.
 */

export enum EventType {
  // Notification events
  NOTIFICATION = 'NOTIFICATION',
  
  // Calendar events
  CALENDAR_EVENT = 'CALENDAR_EVENT',
  CALENDAR_UPDATE = 'CALENDAR_UPDATE',
  CALENDAR_DELETE = 'CALENDAR_DELETE',
  
  // Location events
  LOCATION_UPDATE = 'LOCATION_UPDATE',
  PLACE_ARRIVAL = 'PLACE_ARRIVAL',
  PLACE_DEPARTURE = 'PLACE_DEPARTURE',
  PLACE_TRANSITION = 'PLACE_TRANSITION',
  
  // Activity events
  ACTIVITY_CHANGE = 'ACTIVITY_CHANGE',
  
  // Future: Contact, App Usage, Bluetooth, Sensor events
  CONTACT_INTERACTION = 'CONTACT_INTERACTION',
  APP_USAGE = 'APP_USAGE',
  BLUETOOTH_DEVICE = 'BLUETOOTH_DEVICE',
  SENSOR_DATA = 'SENSOR_DATA',
}

export enum SourceType {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
}

export enum SensitivityLevel {
  PUBLIC = 'PUBLIC',       // Safe to sync/process
  PRIVATE = 'PRIVATE',     // User-controlled
  SENSITIVE = 'SENSITIVE', // Medical, financial, authentication
  CRITICAL = 'CRITICAL',   // Never leave device
}

export enum ActivityType {
  STILL = 'STILL',
  WALKING = 'WALKING',
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  DRIVING = 'DRIVING',
  IN_VEHICLE = 'IN_VEHICLE',
  UNKNOWN = 'UNKNOWN',
}

export enum PlaceType {
  HOME = 'HOME',
  WORK = 'WORK',
  GYM = 'GYM',
  RESTAURANT = 'RESTAURANT',
  SHOP = 'SHOP',
  TRANSIT = 'TRANSIT',
  HEALTHCARE = 'HEALTHCARE',
  EDUCATION = 'EDUCATION',
  ENTERTAINMENT = 'ENTERTAINMENT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Source metadata - where did this event originate?
 */
export interface EventSource {
  type: SourceType;
  collector: string;           // e.g., 'notification', 'calendar', 'location'
  deviceId?: string;
  platform?: string;           // e.g., 'Android 13', 'iOS 16'
  appVersion?: string;
}

/**
 * Privacy metadata - how sensitive is this event?
 */
export interface PrivacyMetadata {
  sensitivity: SensitivityLevel;
  localOnly?: boolean;         // Should never be synced to server
  retentionDays?: number;      // Auto-delete after N days
  encrypted?: boolean;
  redacted?: boolean;          // Has PII been removed?
}

/**
 * Notification event data
 */
export interface NotificationEventData {
  package: string;              // e.g., 'com.whatsapp'
  appName?: string;
  title?: string;               // May be redacted based on privacy
  text?: string;                // May be redacted
  category?: string;            // SOCIAL, MESSAGE, EMAIL, etc.
  priority?: number;
  timestamp: string;
}

/**
 * Calendar event data
 */
export interface CalendarEventData {
  calendarId?: string;
  title: string;
  description?: string;
  startTime: string;            // ISO 8601
  endTime: string;
  location?: string;
  organizer?: string;
  attendees?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
  allDay?: boolean;
}

/**
 * Location event data
 */
export interface LocationEventData {
  latitude: number;
  longitude: number;
  accuracy?: number;            // meters
  altitude?: number;
  speed?: number;               // m/s
  heading?: number;             // degrees
  provider?: string;            // 'gps', 'network', 'fused'
}

/**
 * Place transition data
 */
export interface PlaceTransitionData {
  from?: PlaceType | string;
  to?: PlaceType | string;
  transition: 'ARRIVAL' | 'DEPARTURE';
  placeId?: string;
  placeName?: string;
  location?: LocationEventData;
  confidence?: number;
}

/**
 * Activity recognition data
 */
export interface ActivityEventData {
  activity: ActivityType;
  confidence: number;           // 0.0 - 1.0
  duration?: number;            // milliseconds
  previousActivity?: ActivityType;
}

/**
 * Universal LifeEvent structure
 * 
 * Every event from every source must eventually conform to this schema.
 */
export interface LifeEvent {
  // Core identification
  eventId: string;              // Unique ID (e.g., 'evt_01J...')
  userId: string;
  deviceId?: string;
  
  // Event classification
  type: EventType;
  timestamp: string;            // ISO 8601
  
  // Source tracking
  source: EventSource;
  
  // Event payload (polymorphic based on type)
  data: 
    | NotificationEventData 
    | CalendarEventData 
    | LocationEventData 
    | PlaceTransitionData
    | ActivityEventData 
    | Record<string, any>;
  
  // Confidence and quality
  confidence?: number;          // 0.0 - 1.0
  
  // Privacy and security
  privacy: PrivacyMetadata;
  
  // Optional correlation
  correlationId?: string;       // Link related events
  parentEventId?: string;       // Event hierarchy
  
  // Metadata
  metadata?: Record<string, any>;
  
  // System fields
  createdAt?: string;
  syncedAt?: string;
  processedAt?: string;
}

/**
 * Batch of events for efficient sync
 */
export interface LifeEventBatch {
  deviceId: string;
  userId: string;
  batchId: string;
  events: LifeEvent[];
  timestamp: string;
  checksum?: string;
}

/**
 * Device registration info
 */
export interface DeviceRegistration {
  deviceId: string;
  userId: string;
  deviceName: string;
  platform: string;             // 'android', 'ios'
  osVersion: string;
  appVersion: string;
  
  // Enabled collectors
  collectors: {
    notification: boolean;
    calendar: boolean;
    location: boolean;
    activity: boolean;
    contacts?: boolean;
    appUsage?: boolean;
    bluetooth?: boolean;
  };
  
  // Privacy settings
  privacy: {
    syncEnabled: boolean;
    localProcessingOnly?: boolean;
    dataRetentionDays?: number;
  };
  
  // Sync config
  sync: {
    batchSize: number;
    batchIntervalMs: number;
    retryAttempts: number;
    wifiOnly?: boolean;
  };
  
  publicKey?: string;
  registeredAt: string;
  lastHeartbeat?: string;
}

/**
 * Sync status response
 */
export interface SyncStatus {
  lastSyncAt?: string;
  pendingEvents: number;
  syncedEvents: number;
  failedEvents: number;
  nextSyncAt?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
