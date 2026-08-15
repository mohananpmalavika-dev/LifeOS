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
  title: string;
  summary: string;
  urgency: number;      // 0 - 1
  importance: number;   // 0 - 1
  confidence: number;   // 0 - 1
  confidenceBreakdown: ConfidenceBreakdown;
  score: number;        // Composite rank score (urgency * 0.4 + importance * 0.4 + confidence * 0.2)
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
  dueDate?: string;
  eventContext?: string;
}

export interface CurrentSituation {
  timestamp: string;
  location: {
    place?: string;
    state: string; // 'HOME', 'OFFICE', 'IN_TRANSIT', 'UNKNOWN'
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
}

export interface DecisionResult {
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
