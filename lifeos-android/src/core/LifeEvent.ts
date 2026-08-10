/**
 * Core LifeEvent Types (Android Client)
 * 
 * This mirrors the backend LifeEvent types to ensure compatibility.
 */

export enum EventType {
  NOTIFICATION = 'NOTIFICATION',
  CALENDAR_EVENT = 'CALENDAR_EVENT',
  CALENDAR_UPDATE = 'CALENDAR_UPDATE',
  CALENDAR_DELETE = 'CALENDAR_DELETE',
  LOCATION_UPDATE = 'LOCATION_UPDATE',
  PLACE_ARRIVAL = 'PLACE_ARRIVAL',
  PLACE_DEPARTURE = 'PLACE_DEPARTURE',
  PLACE_TRANSITION = 'PLACE_TRANSITION',
  ACTIVITY_CHANGE = 'ACTIVITY_CHANGE',
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
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SENSITIVE = 'SENSITIVE',
  CRITICAL = 'CRITICAL',
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

export interface EventSource {
  type: SourceType;
  collector: string;
  deviceId?: string;
  platform?: string;
  appVersion?: string;
}

export interface PrivacyMetadata {
  sensitivity: SensitivityLevel;
  localOnly?: boolean;
  retentionDays?: number;
  encrypted?: boolean;
  redacted?: boolean;
}

export interface NotificationEventData {
  package: string;
  appName?: string;
  title?: string;
  text?: string;
  category?: string;
  priority?: number;
  timestamp: string;
}

export interface CalendarEventData {
  calendarId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  organizer?: string;
  attendees?: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
  allDay?: boolean;
}

export interface LocationEventData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  provider?: string;
}

export interface PlaceTransitionData {
  from?: PlaceType | string;
  to?: PlaceType | string;
  transition: 'ARRIVAL' | 'DEPARTURE';
  placeId?: string;
  placeName?: string;
  location?: LocationEventData;
  confidence?: number;
}

export interface ActivityEventData {
  activity: ActivityType;
  confidence: number;
  duration?: number;
  previousActivity?: ActivityType;
}

export interface LifeEvent {
  eventId: string;
  userId: string;
  deviceId?: string;
  type: EventType;
  timestamp: string;
  source: EventSource;
  data:
    | NotificationEventData
    | CalendarEventData
    | LocationEventData
    | PlaceTransitionData
    | ActivityEventData
    | Record<string, any>;
  confidence?: number;
  privacy: PrivacyMetadata;
  correlationId?: string;
  parentEventId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  syncedAt?: string;
  processedAt?: string;
}

export interface LifeEventBatch {
  deviceId: string;
  userId: string;
  batchId: string;
  events: LifeEvent[];
  timestamp: string;
  checksum?: string;
}

export interface DeviceConfig {
  collectors: {
    notification: boolean;
    calendar: boolean;
    location: boolean;
    activity: boolean;
    contacts?: boolean;
    appUsage?: boolean;
    bluetooth?: boolean;
  };
  privacy: {
    syncEnabled: boolean;
    localProcessingOnly?: boolean;
    dataRetentionDays?: number;
  };
  sync: {
    batchSize: number;
    batchIntervalMs: number;
    retryAttempts: number;
    wifiOnly?: boolean;
  };
}
