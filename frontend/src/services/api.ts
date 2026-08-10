import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Type definitions
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

export interface TimelineEvent {
  event: NormalizedEvent;
  confidence: any;
  intervention: Intervention | null;
  timestamp: string;
}

export interface NormalizedEvent {
  id: string;
  event: string;
  source: string;
  timestamp: string;
  entities: string[];
  metadata: Record<string, any>;
  confidence: number;
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

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  context: string[];
  derivedFrom: string[];
}

export interface SensorState {
  batteryLevel: number;
  focusState: 'focused' | 'distracted' | 'idle' | 'offline';
  motionState: 'stationary' | 'walking' | 'driving' | 'transit';
  location: {
    latitude?: number;
    longitude?: number;
    placeLabel?: string;
    geofence?: string;
  };
  ambientSoundLevel?: number;
  lastUpdated: string;
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

// API Methods
export const interventionsApi = {
  getAll: (params?: { priority?: string; limit?: number }) =>
    api.get<{ success: boolean; data: Intervention[] }>('/interventions', { params }),
  
  getById: (id: string) =>
    api.get<{ success: boolean; data: Intervention }>(`/interventions/${id}`),
  
  dismiss: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/interventions/${id}`),
  
  snooze: (id: string, duration: number) =>
    api.post<{ success: boolean; message: string }>(`/interventions/${id}/snooze`, { duration }),
};

export const timelineApi = {
  getAll: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline', { params }),
  
  getToday: () =>
    api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline/today'),
  
  getWeek: () =>
    api.get<{ success: boolean; data: TimelineEvent[] }>('/timeline/week'),
};

export const contextApi = {
  getGraph: () =>
    api.get<{ success: boolean; data: { entities: ContextEntity[]; relations: ContextRelation[] } }>('/context/graph'),
  
  getEntity: (entityId: string) =>
    api.get<{ success: boolean; data: { entity: ContextEntity; relations: ContextRelation[]; relatedEntities: ContextEntity[] } }>(`/context/graph/${entityId}`),
  
  getRelations: (params?: { sourceId?: string; targetId?: string; type?: string }) =>
    api.get<{ success: boolean; data: ContextRelation[] }>('/context/relations', { params }),
};

export const tasksApi = {
  getAll: (params?: { priority?: string }) =>
    api.get<{ success: boolean; data: Task[] }>('/tasks', { params }),
  
  getHighPriority: () =>
    api.get<{ success: boolean; data: Task[] }>('/tasks/high-priority'),
};

export const entitiesApi = {
  getAll: (params?: { type?: string; search?: string; limit?: number }) =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities', { params }),
  
  getPeople: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/people'),
  
  getPlaces: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/places'),
  
  getDocuments: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/documents'),
  
  getEvents: () =>
    api.get<{ success: boolean; data: ContextEntity[] }>('/entities/events'),
  
  getById: (id: string) =>
    api.get<{ success: boolean; data: { entity: ContextEntity; relatedEntities: ContextEntity[] } }>(`/entities/${id}`),
};

export const insightsApi = {
  getAll: () =>
    api.get<{ success: boolean; data: Insights }>('/insights'),
  
  getMetrics: () =>
    api.get<{ success: boolean; data: Insights['metrics'] }>('/insights/metrics'),
  
  getDistributions: () =>
    api.get<{ success: boolean; data: Insights['distributions'] }>('/insights/distributions'),
};

export const stateApi = {
  get: () =>
    api.get<{ success: boolean; data: SensorState }>('/state'),
  
  update: (updates: Partial<SensorState>) =>
    api.put<{ success: boolean; data: SensorState }>('/state', updates),
  
  patch: (updates: Partial<SensorState>) =>
    api.patch<{ success: boolean; data: SensorState }>('/state', updates),
};

export const eventsApi = {
  process: (event: NormalizedEvent) =>
    api.post<{ success: boolean; data: any }>('/events', event),
  
  publish: (event: NormalizedEvent) =>
    api.post<{ success: boolean; message: string }>('/events/publish', event),
};

export default api;
