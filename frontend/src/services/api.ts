import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Intervention {
  id: string;
  title: string;
  summary: string;
  score: number;
  reason: string;
  surfaces: ActionSurface[];
  createdAt: string;
}

export interface ActionSurface {
  type: 'notification' | 'widget' | 'haptic' | 'auto_draft';
  title: string;
  description: string;
  trigger: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  category?: 'MUST_DO' | 'SHOULD_DO' | 'NICE_TO_DO';
  tag?: 'scheduled' | 'location' | 'person' | 'preparation';
  eventContext?: string;
  dueDate?: string;
  completed?: boolean;
}

export interface BriefingData {
  greeting: string;
  summaryText: string;
  currentLocation: string;
  nowCard: {
    eventId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: { name?: string; address?: string; latitude?: number; longitude?: number };
    minutesUntil: number;
    travelMinutes: number;
    prepBufferMinutes?: number;
    learnedBufferOffset?: number;
    leaveByTime: string;
    travelMode: string;
    origin: string;
    documents: Array<{ name: string; required?: boolean; ready?: boolean }>;
    reasoning?: {
      confidence: number;
      originPlace: string;
      destinationPlace: string;
      travelTimeText: string;
      prepBufferText: string;
    };
  } | null;
  nextCard: {
    eventId: string;
    title: string;
    startTime: string;
    endTime: string;
    location?: { name?: string };
    travelMinutes: number;
  } | null;
  attentionItems: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    summary?: string;
    reason?: string;
    recommendation?: string;
    surfaces?: ActionSurface[];
    score?: number;
    timestamp: string;
  }>;
  eveningReview?: {
    isEvening: boolean;
    completedSummary: string;
    learnedInsight: string;
    tomorrowPreview: {
      eventCount: number;
      firstEvent: string;
    };
  };
  feasibilityScore: number;
  totalEvents: number;
  timestamp: string;
}

export interface ContextEntity {
  id: string;
  type: string;
  title: string;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ContextRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
  createdAt: string;
}

export interface Insights {
  metrics: {
    contextAccuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    falsePositives: number;
  };
  counts: {
    totalEntities: number;
    totalRelations: number;
    totalInterventions: number;
    highPriorityInterventions: number;
    recentEvents: number;
  };
  distributions: {
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
  };
  interventionAnalytics: {
    avgScore: number;
    scoreDistribution: {
      high: number;
      medium: number;
      low: number;
    };
  };
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  event: string;
  timestamp: string;
  source: string;
  confidence?: number;
  metadata?: Record<string, any>;
  entities?: ContextEntity[];
  intervention?: Intervention;
}

export interface SensorState {
  batteryLevel: number;
  focusState: string;
  motionState: string;
  location: {
    latitude?: number;
    longitude?: number;
    placeLabel?: string;
    geofence?: string;
  };
  ambientSoundLevel?: number;
  lastUpdated: string;
}

export const briefingApi = {
  getToday: () => api.get<{ success: boolean; data: BriefingData }>('/briefing/today'),
  getEvening: () => api.get<{ success: boolean; data: any }>('/briefing/evening'),
};

export const askApi = {
  ask: (query: string) => api.post<{ success: boolean; data: any }>('/ask', { query }),
};

export const memoryApi = {
  getAll: () => api.get<{ success: boolean; data: any; totalItems: number }>('/memory'),
  update: (id: string, updates: { title?: string; detail?: string; semanticType?: string }) =>
    api.put<{ success: boolean; message: string }>(`/memory/${id}`, updates),
  forget: (id: string) => api.delete<{ success: boolean; message: string }>(`/memory/${id}`),
};

export const privacyCenterApi = {
  getOverview: () => api.get<{ success: boolean; data: any }>('/privacy-center/overview'),
  clear: (scope: string) => api.post<{ success: boolean; message: string }>('/privacy-center/clear', { scope }),
  clearCategory: (category: string) => api.post<{ success: boolean; message: string }>('/privacy-center/clear-category', { category }),
  pause: (paused?: boolean) => api.post<{ success: boolean; isPaused: boolean }>('/privacy-center/pause', { paused }),
};

export const interventionsApi = {
  getAll: (params?: { priority?: string; limit?: number; dismissed?: boolean }) =>
    api.get<{ success: boolean; count: number; data: Intervention[] }>('/interventions', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: Intervention }>(`/interventions/${id}`),
  dismiss: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/interventions/${id}`),
  snooze: (id: string, duration: number) =>
    api.post<{ success: boolean; message: string }>(`/interventions/${id}/snooze`, { duration }),
  feedback: (id: string, useful: boolean, reason?: string, category?: string) =>
    api.post<{ success: boolean; message: string }>(`/interventions/${id}/feedback`, { useful, reason, category }),
  getFeedbackStats: () =>
    api.get<{ success: boolean; data: any }>('/interventions/feedback/stats'),
};

export const tasksApi = {
  getAll: (params?: { priority?: string; eventContext?: string; completed?: boolean }) =>
    api.get<{ success: boolean; count: number; data: Task[]; eventGroups: Record<string, Task[]>; summary: any }>('/tasks', { params }),
  getHighPriority: () =>
    api.get<{ success: boolean; count: number; data: Task[] }>('/tasks/high-priority'),
  create: (task: Partial<Task>) =>
    api.post<{ success: boolean; data: Task; message: string }>('/tasks', task),
  update: (id: string, updates: Partial<Task>) =>
    api.patch<{ success: boolean; data: Task; message: string }>(`/tasks/${id}`, updates),
  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/tasks/${id}`),
};

export const calendarApi = {
  getEvents: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/calendar/schedule', { params }),
  getConflicts: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/calendar/conflicts', { params }),
  getFeasibility: (date: string) =>
    api.get(`/calendar/feasibility/${date}`),
  createEvent: (event: any) =>
    api.post('/calendar/events', event),
  deleteEvent: (id: string) =>
    api.delete(`/calendar/events/${id}`),
};

export const stateApi = {
  get: () => api.get<{ success: boolean; data: SensorState }>('/state'),
  update: (updates: Partial<SensorState>) => api.put<{ success: boolean; data: SensorState }>('/state', updates),
  getFocusMode: () => api.get<{ success: boolean; mode: string; description: string }>('/state/focus-mode'),
  setFocusMode: (mode: string) => api.post<{ success: boolean; mode: string; description: string }>('/state/focus-mode', { mode }),
};

export const entitiesApi = {
  getAll: (params?: { type?: string; search?: string; limit?: number }) =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: { entity: ContextEntity; relatedEntities: ContextEntity[] } }>(`/entities/${id}`),
  getPeople: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/people'),
  getPlaces: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/places'),
  getDocuments: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/documents'),
};

export const contextApi = {
  getGraph: () => api.get<{ success: boolean; data: { entities: ContextEntity[]; relations: ContextRelation[] } }>('/context/graph'),
  getStats: () => api.get('/context/stats'),
};

export const insightsApi = {
  getAll: () => api.get<{ success: boolean; data: Insights }>('/insights'),
};

export const timelineApi = {
  getToday: () => api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline/today'),
  getWeek: () => api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline/week'),
  getAll: (params?: { limit?: number }) => api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline', { params }),
};

export { api };
export default api;

export interface ActionCandidateData {
  id: string;
  type: string;
  title: string;
  summary: string;
  urgency: number;
  importance: number;
  confidence: number;
  score: number;
  confidenceBreakdown: {
    calendar: number;
    location: number;
    travel: number;
    preparation: number;
    userPattern: number;
    overall: number;
  };
  timing?: {
    recommendedAt?: string;
    deadline?: string;
    travelMinutes?: number;
    prepMinutes?: number;
    bufferMinutes?: number;
  };
  evidence: Array<{
    source: string;
    title: string;
    detail: string;
    confidence: number;
  }>;
  actionSurfaces: Array<{
    type: string;
    label: string;
    intent?: string;
  }>;
}

export interface DecisionPayload {
  situation: {
    timestamp: string;
    location: { place?: string; state: string; confidence: number };
    activity: { type: string; confidence: number };
    nextEvent?: any;
    recentNotifications: any[];
    activeFocusMode: string;
    device: { online: boolean; batteryLevel: number };
  };
  bestAction: ActionCandidateData;
  candidates: ActionCandidateData[];
  surface: 'PUSH_NOTIFICATION' | 'HOME_CARD' | 'DAILY_BRIEFING' | 'SILENT';
  explanation: {
    headline: string;
    narrative: string;
    evidenceList: Array<{ source: string; title: string; detail: string; confidence: number }>;
  };
  timestamp: string;
}

export const decisionsApi = {
  getCurrent: () => api.get<{ success: boolean; data: DecisionPayload }>('/decisions/current'),
  getDebugger: () => api.get<{ success: boolean; data: any }>('/decisions/debugger'),
  feedback: (candidateId: string, action: string, useful?: boolean, reason?: string) =>
    api.post('/decisions/feedback', { candidateId, action, useful, reason }),
};
