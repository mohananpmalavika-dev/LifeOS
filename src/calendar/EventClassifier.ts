/**
 * Calendar Event Classifier
 * 
 * Classifies calendar events into types and provides preparation profiles
 */

import { EventType, EventTypeProfile, LifeCalendarEvent } from './types.js';

/**
 * Event Type Preparation Profiles
 * Defines expected characteristics for each event type
 */
export const EVENT_TYPE_PROFILES: Record<EventType, EventTypeProfile> = {
  [EventType.MEDICAL_APPOINTMENT]: {
    eventType: EventType.MEDICAL_APPOINTMENT,
    travelLikelihood: 0.95,
    preparationLikelihood: 0.7,
    documentLikelihood: 0.8,
    typicalDurationMin: 45,
    defaultImportance: 0.85,
    defaultFlexibility: 0.15
  },
  
  [EventType.WORK_MEETING]: {
    eventType: EventType.WORK_MEETING,
    travelLikelihood: 0.5,
    preparationLikelihood: 0.6,
    documentLikelihood: 0.5,
    typicalDurationMin: 60,
    defaultImportance: 0.7,
    defaultFlexibility: 0.6
  },
  
  [EventType.PERSONAL_MEETING]: {
    eventType: EventType.PERSONAL_MEETING,
    travelLikelihood: 0.6,
    preparationLikelihood: 0.3,
    documentLikelihood: 0.2,
    typicalDurationMin: 90,
    defaultImportance: 0.6,
    defaultFlexibility: 0.7
  },
  
  [EventType.FLIGHT]: {
    eventType: EventType.FLIGHT,
    travelLikelihood: 1.0,
    preparationLikelihood: 0.95,
    documentLikelihood: 0.95,
    typicalDurationMin: 180,
    defaultImportance: 0.95,
    defaultFlexibility: 0.05
  },
  
  [EventType.TRAIN]: {
    eventType: EventType.TRAIN,
    travelLikelihood: 1.0,
    preparationLikelihood: 0.7,
    documentLikelihood: 0.7,
    typicalDurationMin: 120,
    defaultImportance: 0.8,
    defaultFlexibility: 0.2
  },
  
  [EventType.BUS]: {
    eventType: EventType.BUS,
    travelLikelihood: 1.0,
    preparationLikelihood: 0.5,
    documentLikelihood: 0.4,
    typicalDurationMin: 90,
    defaultImportance: 0.7,
    defaultFlexibility: 0.3
  },
  
  [EventType.EDUCATION]: {
    eventType: EventType.EDUCATION,
    travelLikelihood: 0.8,
    preparationLikelihood: 0.6,
    documentLikelihood: 0.5,
    typicalDurationMin: 120,
    defaultImportance: 0.75,
    defaultFlexibility: 0.3
  },
  
  [EventType.EXAM]: {
    eventType: EventType.EXAM,
    travelLikelihood: 0.9,
    preparationLikelihood: 0.9,
    documentLikelihood: 0.9,
    typicalDurationMin: 180,
    defaultImportance: 0.95,
    defaultFlexibility: 0.05
  },
  
  [EventType.RESTAURANT]: {
    eventType: EventType.RESTAURANT,
    travelLikelihood: 0.9,
    preparationLikelihood: 0.2,
    documentLikelihood: 0.1,
    typicalDurationMin: 90,
    defaultImportance: 0.5,
    defaultFlexibility: 0.7
  },
  
  [EventType.BANKING]: {
    eventType: EventType.BANKING,
    travelLikelihood: 0.8,
    preparationLikelihood: 0.7,
    documentLikelihood: 0.8,
    typicalDurationMin: 45,
    defaultImportance: 0.7,
    defaultFlexibility: 0.4
  },
  
  [EventType.GOVERNMENT]: {
    eventType: EventType.GOVERNMENT,
    travelLikelihood: 0.9,
    preparationLikelihood: 0.9,
    documentLikelihood: 0.95,
    typicalDurationMin: 60,
    defaultImportance: 0.9,
    defaultFlexibility: 0.1
  },
  
  [EventType.LEGAL]: {
    eventType: EventType.LEGAL,
    travelLikelihood: 0.85,
    preparationLikelihood: 0.9,
    documentLikelihood: 0.9,
    typicalDurationMin: 90,
    defaultImportance: 0.9,
    defaultFlexibility: 0.15
  },
  
  [EventType.SPORT]: {
    eventType: EventType.SPORT,
    travelLikelihood: 0.8,
    preparationLikelihood: 0.5,
    documentLikelihood: 0.1,
    typicalDurationMin: 120,
    defaultImportance: 0.6,
    defaultFlexibility: 0.5
  },
  
  [EventType.EXERCISE]: {
    eventType: EventType.EXERCISE,
    travelLikelihood: 0.7,
    preparationLikelihood: 0.3,
    documentLikelihood: 0.05,
    typicalDurationMin: 60,
    defaultImportance: 0.5,
    defaultFlexibility: 0.8
  },
  
  [EventType.FAMILY]: {
    eventType: EventType.FAMILY,
    travelLikelihood: 0.6,
    preparationLikelihood: 0.4,
    documentLikelihood: 0.1,
    typicalDurationMin: 120,
    defaultImportance: 0.75,
    defaultFlexibility: 0.5
  },
  
  [EventType.BIRTHDAY]: {
    eventType: EventType.BIRTHDAY,
    travelLikelihood: 0.7,
    preparationLikelihood: 0.6,
    documentLikelihood: 0.1,
    typicalDurationMin: 150,
    defaultImportance: 0.8,
    defaultFlexibility: 0.2
  },
  
  [EventType.ANNIVERSARY]: {
    eventType: EventType.ANNIVERSARY,
    travelLikelihood: 0.7,
    preparationLikelihood: 0.7,
    documentLikelihood: 0.1,
    typicalDurationMin: 180,
    defaultImportance: 0.85,
    defaultFlexibility: 0.2
  },
  
  [EventType.SHOPPING]: {
    eventType: EventType.SHOPPING,
    travelLikelihood: 0.8,
    preparationLikelihood: 0.2,
    documentLikelihood: 0.1,
    typicalDurationMin: 90,
    defaultImportance: 0.4,
    defaultFlexibility: 0.9
  },
  
  [EventType.DELIVERY]: {
    eventType: EventType.DELIVERY,
    travelLikelihood: 0.1,
    preparationLikelihood: 0.3,
    documentLikelihood: 0.2,
    typicalDurationMin: 15,
    defaultImportance: 0.6,
    defaultFlexibility: 0.3
  },
  
  [EventType.TRAVEL]: {
    eventType: EventType.TRAVEL,
    travelLikelihood: 1.0,
    preparationLikelihood: 0.8,
    documentLikelihood: 0.7,
    typicalDurationMin: 240,
    defaultImportance: 0.8,
    defaultFlexibility: 0.2
  },
  
  [EventType.OTHER]: {
    eventType: EventType.OTHER,
    travelLikelihood: 0.5,
    preparationLikelihood: 0.3,
    documentLikelihood: 0.2,
    typicalDurationMin: 60,
    defaultImportance: 0.5,
    defaultFlexibility: 0.7
  }
};

/**
 * Classification patterns for event types
 */
interface ClassificationPattern {
  keywords?: string[];
  locationKeywords?: string[];
  weight: number;
}

const CLASSIFICATION_PATTERNS: Record<EventType, ClassificationPattern[]> = {
  [EventType.MEDICAL_APPOINTMENT]: [
    { keywords: ['doctor', 'dentist', 'hospital', 'clinic', 'appointment', 'checkup', 'medical', 'health'], weight: 0.9 },
    { keywords: ['dr.', 'physician', 'dental', 'surgery', 'therapy'], weight: 0.85 },
    { locationKeywords: ['hospital', 'clinic', 'medical center', 'health'], weight: 0.8 }
  ],
  
  [EventType.WORK_MEETING]: [
    { keywords: ['meeting', 'standup', 'sync', 'review', 'discussion', 'call', 'conference'], weight: 0.7 },
    { keywords: ['client', 'presentation', 'demo', 'sprint', 'retrospective', 'planning'], weight: 0.75 },
    { keywords: ['team', 'project', 'status', 'update', 'weekly', 'daily'], weight: 0.65 }
  ],
  
  [EventType.FLIGHT]: [
    { keywords: ['flight', 'airline', 'boarding', 'departure', 'arrival', 'gate'], weight: 0.95 },
    { locationKeywords: ['airport', 'terminal'], weight: 0.9 }
  ],
  
  [EventType.TRAIN]: [
    { keywords: ['train', 'railway', 'rail', 'platform', 'station'], weight: 0.9 },
    { locationKeywords: ['station', 'railway', 'terminal'], weight: 0.85 }
  ],
  
  [EventType.BUS]: [
    { keywords: ['bus', 'coach'], weight: 0.85 },
    { locationKeywords: ['bus stop', 'bus station', 'terminal'], weight: 0.8 }
  ],
  
  [EventType.EXAM]: [
    { keywords: ['exam', 'test', 'examination', 'assessment', 'quiz'], weight: 0.9 },
    { keywords: ['midterm', 'final', 'entrance', 'certification'], weight: 0.85 }
  ],
  
  [EventType.EDUCATION]: [
    { keywords: ['class', 'lecture', 'seminar', 'workshop', 'training', 'course'], weight: 0.8 },
    { keywords: ['lesson', 'tutorial', 'lab', 'study'], weight: 0.75 },
    { locationKeywords: ['school', 'university', 'college', 'classroom'], weight: 0.7 }
  ],
  
  [EventType.RESTAURANT]: [
    { keywords: ['lunch', 'dinner', 'breakfast', 'brunch', 'meal'], weight: 0.7 },
    { keywords: ['restaurant', 'cafe', 'coffee', 'dining'], weight: 0.8 },
    { locationKeywords: ['restaurant', 'cafe', 'bistro', 'diner'], weight: 0.85 }
  ],
  
  [EventType.BANKING]: [
    { keywords: ['bank', 'banking', 'account', 'loan', 'mortgage', 'financial'], weight: 0.85 },
    { locationKeywords: ['bank', 'branch', 'atm'], weight: 0.8 }
  ],
  
  [EventType.GOVERNMENT]: [
    { keywords: ['visa', 'passport', 'embassy', 'consulate', 'permit', 'license'], weight: 0.85 },
    { keywords: ['government', 'municipal', 'dmv', 'courthouse'], weight: 0.8 },
    { locationKeywords: ['embassy', 'consulate', 'government office', 'city hall'], weight: 0.85 }
  ],
  
  [EventType.LEGAL]: [
    { keywords: ['lawyer', 'attorney', 'legal', 'court', 'hearing', 'deposition'], weight: 0.85 },
    { locationKeywords: ['law office', 'courthouse', 'legal'], weight: 0.8 }
  ],
  
  [EventType.SPORT]: [
    { keywords: ['game', 'match', 'tournament', 'championship', 'sport'], weight: 0.8 },
    { keywords: ['football', 'basketball', 'tennis', 'soccer', 'cricket'], weight: 0.75 },
    { locationKeywords: ['stadium', 'arena', 'court', 'field'], weight: 0.85 }
  ],
  
  [EventType.EXERCISE]: [
    { keywords: ['gym', 'workout', 'fitness', 'exercise', 'yoga', 'pilates'], weight: 0.85 },
    { keywords: ['swimming', 'running', 'cycling', 'training'], weight: 0.75 },
    { locationKeywords: ['gym', 'fitness center', 'studio'], weight: 0.8 }
  ],
  
  [EventType.BIRTHDAY]: [
    { keywords: ['birthday', 'bday', 'b-day', 'born'], weight: 0.95 }
  ],
  
  [EventType.ANNIVERSARY]: [
    { keywords: ['anniversary'], weight: 0.95 }
  ],
  
  [EventType.FAMILY]: [
    { keywords: ['family', 'parents', 'kids', 'children', 'relatives'], weight: 0.75 }
  ],
  
  [EventType.SHOPPING]: [
    { keywords: ['shopping', 'shop', 'store', 'mall', 'grocery', 'market'], weight: 0.8 },
    { locationKeywords: ['mall', 'store', 'market', 'shop'], weight: 0.75 }
  ],
  
  [EventType.DELIVERY]: [
    { keywords: ['delivery', 'package', 'shipment', 'pickup'], weight: 0.85 }
  ],
  
  [EventType.TRAVEL]: [
    { keywords: ['travel', 'trip', 'journey', 'vacation', 'holiday'], weight: 0.8 }
  ],
  
  [EventType.PERSONAL_MEETING]: [
    { keywords: ['coffee', 'catch up', 'hangout', 'meetup', 'chat'], weight: 0.7 },
    { keywords: ['friend', 'personal'], weight: 0.65 }
  ],
  
  [EventType.OTHER]: []
};

export class EventClassifier {
  /**
   * Classify a calendar event into an event type
   */
  classify(event: LifeCalendarEvent): { type: EventType; confidence: number } {
    const text = this.extractText(event);
    const scores: Map<EventType, number> = new Map();
    
    // Calculate scores for each event type
    for (const [eventType, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
      let score = 0;
      let maxWeight = 0;
      
      for (const pattern of patterns) {
        maxWeight = Math.max(maxWeight, pattern.weight);
        
        // Check title and description keywords
        const keywordMatch = pattern.keywords
          ? pattern.keywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))
          : false;
        
        if (keywordMatch) {
          score = Math.max(score, pattern.weight);
        }
        
        // Check location keywords
        if (pattern.locationKeywords && event.location?.name) {
          const locationMatch = pattern.locationKeywords.some(keyword =>
            event.location!.name!.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (locationMatch) {
            score = Math.max(score, pattern.weight);
          }
        }
      }
      
      scores.set(eventType as EventType, score);
    }
    
    // Find best match
    let bestType = EventType.OTHER;
    let bestScore = 0;
    
    for (const [type, score] of scores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    
    // Apply heuristics for common patterns
    const enhancedResult = this.applyHeuristics(event, bestType, bestScore);
    
    return enhancedResult;
  }
  
  /**
   * Extract searchable text from event
   */
  private extractText(event: LifeCalendarEvent): string {
    const parts: string[] = [];
    
    if (event.title) parts.push(event.title);
    if (event.description) parts.push(event.description);
    if (event.location?.name) parts.push(event.location.name);
    
    return parts.join(' ');
  }
  
  /**
   * Apply additional heuristics for classification
   */
  private applyHeuristics(
    event: LifeCalendarEvent,
    initialType: EventType,
    initialScore: number
  ): { type: EventType; confidence: number } {
    let type = initialType;
    let confidence = initialScore;
    
    // If organizer has corporate email, likely work meeting
    if (event.organizer?.email && this.isCorporateEmail(event.organizer.email)) {
      if (initialScore < 0.7) {
        type = EventType.WORK_MEETING;
        confidence = 0.7;
      }
    }
    
    // Multiple attendees suggest meeting
    if (event.attendees.length > 2 && initialScore < 0.6) {
      type = EventType.WORK_MEETING;
      confidence = 0.65;
    }
    
    // Short events (< 30 min) are often standups
    const duration = this.calculateDuration(event);
    if (duration <= 30 && initialType === EventType.WORK_MEETING) {
      confidence = Math.min(0.85, confidence + 0.1);
    }
    
    // Very long events (> 4 hours) might be travel or all-day events
    if (duration > 240 && initialScore < 0.6) {
      const text = this.extractText(event).toLowerCase();
      if (text.includes('out of office') || text.includes('ooo') || text.includes('pto')) {
        type = EventType.TRAVEL;
        confidence = 0.7;
      }
    }
    
    // Recurring daily/weekly meetings
    if (event.recurrence?.frequency === 'DAILY' || 
        (event.recurrence?.frequency === 'WEEKLY' && duration <= 60)) {
      if (initialType === EventType.WORK_MEETING || initialScore < 0.6) {
        type = EventType.WORK_MEETING;
        confidence = Math.max(confidence, 0.75);
      }
    }
    
    return { type, confidence };
  }
  
  /**
   * Check if email is corporate domain
   */
  private isCorporateEmail(email: string): boolean {
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? !personalDomains.includes(domain) : false;
  }
  
  /**
   * Calculate event duration in minutes
   */
  private calculateDuration(event: LifeCalendarEvent): number {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return (end.getTime() - start.getTime()) / (1000 * 60);
  }
  
  /**
   * Get event type profile
   */
  getProfile(eventType: EventType): EventTypeProfile {
    return EVENT_TYPE_PROFILES[eventType];
  }
  
  /**
   * Get recommended document types for event type
   */
  getRecommendedDocuments(eventType: EventType): string[] {
    const documentMap: Record<EventType, string[]> = {
      [EventType.MEDICAL_APPOINTMENT]: ['Medical ID', 'Insurance Card', 'Medical Records', 'Prescription'],
      [EventType.FLIGHT]: ['Passport', 'ID', 'Boarding Pass', 'Visa', 'Travel Insurance'],
      [EventType.TRAIN]: ['ID', 'Ticket', 'Reservation'],
      [EventType.BUS]: ['Ticket', 'ID'],
      [EventType.EXAM]: ['Hall Ticket', 'ID', 'Admit Card', 'Stationery'],
      [EventType.GOVERNMENT]: ['ID', 'Passport', 'Documents', 'Application Form', 'Photos'],
      [EventType.LEGAL]: ['ID', 'Legal Documents', 'Contract', 'Evidence'],
      [EventType.BANKING]: ['ID', 'Bank Documents', 'Application'],
      [EventType.WORK_MEETING]: ['Laptop', 'Presentation', 'Documents'],
      [EventType.EDUCATION]: ['Notebook', 'Textbook', 'ID'],
      [EventType.TRAVEL]: ['Passport', 'Visa', 'Itinerary', 'Hotel Booking', 'Travel Insurance'],
      [EventType.PERSONAL_MEETING]: [],
      [EventType.RESTAURANT]: [],
      [EventType.SHOPPING]: ['Shopping List', 'Payment Card'],
      [EventType.DELIVERY]: [],
      [EventType.SPORT]: ['Tickets', 'ID'],
      [EventType.EXERCISE]: ['Gym Membership', 'Workout Gear'],
      [EventType.FAMILY]: [],
      [EventType.BIRTHDAY]: ['Gift', 'Card'],
      [EventType.ANNIVERSARY]: ['Gift', 'Reservation Confirmation'],
      [EventType.OTHER]: []
    };
    
    return documentMap[eventType] || [];
  }
}
