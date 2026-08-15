
export interface ContextObservation<T> {
  value: T;
  source: 'ANDROID_SENSOR' | 'GPS' | 'CALENDAR' | 'NOTIFICATION' | 'DATABASE' | 'USER' | 'INFERENCE';
  confidence: number;
  observedAt: string;
  ageSeconds?: number;
  ttlSeconds?: number;
  isStale?: boolean;
}
export type CandidateType = 
  | 'LEAVE'
  | 'PREPARE'
  | 'BRING'
  | 'RESPOND'
  | 'REMIND'
  | 'RESOLVE_CONFLICT'
  | 'FOLLOW_UP'
  | 'NO_ACTION';

export type InterventionSurface = 
  | 'PUSH_NOTIFICATION'
  | 'HOME_CARD'
  | 'DAILY_BRIEFING'
  | 'SILENT';

export type FocusMode = 'NORMAL' | 'WORK' | 'DRIVING' | 'MEETING' | 'SLEEP' | 'TRAVEL';

export interface Evidence {
  source: 'CALENDAR' | 'LOCATION' | 'TRAVEL' | 'NOTIFICATION' | 'PREPARATION' | 'TASK' | 'PATTERN';
  title: string;
  detail: string;
  confidence: number;
}

export interface ConfidenceBreakdown {
  calendar: number;
  location: number;
  travel: number;
  preparation: number;
  userPattern: number;
  overall: number;
}

export interface ActionCandidate {
  id: string;
  type: CandidateType;
  category?: string;
  title: string;
  summary: string;
  urgency: number;      // 0 - 1
  importance: number;   // 0 - 1
  confidence: number;   // 0 - 1
  confidenceBreakdown: ConfidenceBreakdown;
  score: number;        // Computed consistently: (urgency * 0.40 + importance * 0.40 + confidence * 0.20) * categorySensitivity
  timing?: {
    recommendedAt?: string;
    deadline?: string;
    travelMinutes?: number;
    prepMinutes?: number;
    bufferMinutes?: number;
  };
  evidence: Evidence[];
  actionSurfaces: Array<{
    type: string;
    label: string;
    intent?: string;
    url?: string;
  }>;
}

export interface CalendarContext {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  description?: string;
  travelMinutes?: number;
  prepMinutes?: number;
  requiredDocuments?: Array<{ name: string; required?: boolean; ready?: boolean }>;
  preparationItems?: Array<{ type: string; description: string }>;
}

export interface NotificationContext {
  id: string;
  title: string;
  text: string;
  category: string;
  amount?: number;
  dueDate?: string;
  timestamp: string;
}

export interface TaskContext {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  category?: 'MUST_DO' | 'SHOULD_DO' | 'NICE_TO_DO';
  dueDate?: string;
  eventContext?: string;
  completed?: boolean;
}

export interface CurrentSituation {
  timestamp: string;
  location: {
    place?: string;
    state: string;
    latitude?: number;
    longitude?: number;
    confidence: number;
  };
  activity: {
    type: 'STILL' | 'WALKING' | 'DRIVING' | 'CYCLING' | 'UNKNOWN';
    confidence: number;
  };
  nextEvent?: CalendarContext;
  conflictingEvent?: CalendarContext;
  recentNotifications: NotificationContext[];
  pendingTasks: TaskContext[];
  activeFocusMode: FocusMode;
  device: {
    online: boolean;
    batteryLevel: number;
  };
  userPreferences: {
    departureBufferOffsetMin: number;
    categorySensitivity: Record<string, number>;
  };
}

export interface DecisionResult {
  decisionId: string;
  traceId: string;
  situation: CurrentSituation;
  bestAction: ActionCandidate;
  candidates: ActionCandidate[];
  surface: InterventionSurface;
  explanation: {
    headline: string;
    narrative: string;
    evidenceList: Evidence[];
  };
  timestamp: string;
}
