/**
 * Context Service
 * 
 * Communicates with backend to fetch fused life contexts
 */

import axios from 'axios';

export interface FusedContext {
  contextType: string;
  confidence: number;
  startTime: string;
  endTime?: string;
  insights: {
    description: string;
    key_signals: string[];
    confidence_factors: string[];
  };
  recommendations?: string[];
  metadata?: Record<string, any>;
}

export class ContextService {
  private apiBaseUrl: string;
  private userId: string;

  constructor(apiBaseUrl: string, userId: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.userId = userId;
  }

  /**
   * Get current life context
   */
  async getCurrentContext(): Promise<FusedContext | null> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/v1/life-context/current`,
        {
          params: { userId: this.userId },
          timeout: 10000,
        }
      );

      if (response.data.success && response.data.data.context) {
        return response.data.data.context;
      }

      return null;
    } catch (error) {
      console.error('[ContextService] Error fetching current context:', error);
      return null;
    }
  }

  /**
   * Analyze recent contexts
   */
  async analyzeContexts(timeWindowMinutes: number = 60): Promise<FusedContext[]> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/v1/life-context/analyze`,
        {
          params: {
            userId: this.userId,
            timeWindowMinutes,
          },
          timeout: 10000,
        }
      );

      if (response.data.success && response.data.data.contexts) {
        return response.data.data.contexts;
      }

      return [];
    } catch (error) {
      console.error('[ContextService] Error analyzing contexts:', error);
      return [];
    }
  }

  /**
   * Get context timeline
   */
  async getTimeline(startTime?: string, endTime?: string): Promise<any[]> {
    try {
      const params: any = { userId: this.userId };
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(
        `${this.apiBaseUrl}/api/v1/life-context/timeline`,
        {
          params,
          timeout: 15000,
        }
      );

      if (response.data.success && response.data.data.timeline) {
        return response.data.data.timeline;
      }

      return [];
    } catch (error) {
      console.error('[ContextService] Error fetching timeline:', error);
      return [];
    }
  }
}
