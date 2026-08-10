/**
 * Notification Classifier
 * 
 * Multi-stage classifier that determines notification relevance and intent.
 * Uses rules → app intelligence → keyword detection → confidence scoring.
 */

import type { NormalizedNotification } from './NotificationNormalizer';

export enum NotificationRelevance {
  RELEVANT = 'RELEVANT',
  IRRELEVANT = 'IRRELEVANT',
  SENSITIVE = 'SENSITIVE',
  UNKNOWN = 'UNKNOWN',
}

export enum NotificationCategory {
  FINANCE = 'FINANCE',
  HEALTH = 'HEALTH',
  TRAVEL = 'TRAVEL',
  WORK = 'WORK',
  EDUCATION = 'EDUCATION',
  FAMILY = 'FAMILY',
  SHOPPING = 'SHOPPING',
  DELIVERY = 'DELIVERY',
  FOOD = 'FOOD',
  SOCIAL = 'SOCIAL',
  COMMUNICATION = 'COMMUNICATION',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  PROMOTION = 'PROMOTION',
  OTHER = 'OTHER',
}

export enum NotificationIntent {
  BILL_DUE = 'BILL_DUE',
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  APPOINTMENT = 'APPOINTMENT',
  TRAVEL = 'TRAVEL',
  MESSAGE = 'MESSAGE',
  SECURITY_ALERT = 'SECURITY_ALERT',
  PROMOTION = 'PROMOTION',
  REMINDER = 'REMINDER',
  UPDATE = 'UPDATE',
  SOCIAL_INTERACTION = 'SOCIAL_INTERACTION',
  OTHER = 'OTHER',
}

export enum NotificationAction {
  PAY = 'PAY',
  SCHEDULE = 'SCHEDULE',
  CONFIRM = 'CONFIRM',
  REVIEW = 'REVIEW',
  RESPOND = 'RESPOND',
  ATTEND = 'ATTEND',
  TRACK = 'TRACK',
  READ = 'READ',
  NONE = 'NONE',
}

export interface NotificationClassification {
  relevance: NotificationRelevance;
  category: NotificationCategory;
  intent: NotificationIntent;
  action: NotificationAction;
  priority: number; // 0-1
  confidence: number; // 0-1
  reasons: string[];
}

export interface AppRegistry {
  [packagePattern: string]: {
    domain: NotificationCategory;
    defaultSensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
    defaultRelevance: number; // 0-1
  };
}

export class NotificationClassifier {
  // App intelligence registry
  private static APP_REGISTRY: AppRegistry = {
    // Banking & Finance
    'bank': { domain: NotificationCategory.FINANCE, defaultSensitivity: 'HIGH', defaultRelevance: 0.9 },
    'paytm': { domain: NotificationCategory.FINANCE, defaultSensitivity: 'HIGH', defaultRelevance: 0.8 },
    'phonepe': { domain: NotificationCategory.FINANCE, defaultSensitivity: 'HIGH', defaultRelevance: 0.8 },
    'gpay': { domain: NotificationCategory.FINANCE, defaultSensitivity: 'HIGH', defaultRelevance: 0.8 },
    'upi': { domain: NotificationCategory.FINANCE, defaultSensitivity: 'HIGH', defaultRelevance: 0.8 },
    
    // Healthcare
    'health': { domain: NotificationCategory.HEALTH, defaultSensitivity: 'HIGH', defaultRelevance: 0.85 },
    'hospital': { domain: NotificationCategory.HEALTH, defaultSensitivity: 'HIGH', defaultRelevance: 0.85 },
    'practo': { domain: NotificationCategory.HEALTH, defaultSensitivity: 'HIGH', defaultRelevance: 0.8 },
    'medical': { domain: NotificationCategory.HEALTH, defaultSensitivity: 'HIGH', defaultRelevance: 0.85 },
    
    // Travel
    'uber': { domain: NotificationCategory.TRAVEL, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.75 },
    'ola': { domain: NotificationCategory.TRAVEL, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.75 },
    'makemytrip': { domain: NotificationCategory.TRAVEL, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.8 },
    'irctc': { domain: NotificationCategory.TRAVEL, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.85 },
    'airline': { domain: NotificationCategory.TRAVEL, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.85 },
    
    // Food & Delivery
    'swiggy': { domain: NotificationCategory.FOOD, defaultSensitivity: 'LOW', defaultRelevance: 0.65 },
    'zomato': { domain: NotificationCategory.FOOD, defaultSensitivity: 'LOW', defaultRelevance: 0.65 },
    'amazon': { domain: NotificationCategory.DELIVERY, defaultSensitivity: 'LOW', defaultRelevance: 0.6 },
    'flipkart': { domain: NotificationCategory.DELIVERY, defaultSensitivity: 'LOW', defaultRelevance: 0.6 },
    
    // Communication
    'whatsapp': { domain: NotificationCategory.COMMUNICATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.5 },
    'telegram': { domain: NotificationCategory.COMMUNICATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.5 },
    'gmail': { domain: NotificationCategory.COMMUNICATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.5 },
    
    // Work
    'slack': { domain: NotificationCategory.WORK, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.7 },
    'teams': { domain: NotificationCategory.WORK, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.7 },
    'outlook': { domain: NotificationCategory.WORK, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.7 },
    
    // Education
    'school': { domain: NotificationCategory.EDUCATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.75 },
    'college': { domain: NotificationCategory.EDUCATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.75 },
    'university': { domain: NotificationCategory.EDUCATION, defaultSensitivity: 'MEDIUM', defaultRelevance: 0.75 },
  };

  // High relevance keywords
  private static HIGH_RELEVANCE_KEYWORDS = [
    'electricity', 'water bill', 'gas bill', 'insurance', 'emi', 'loan',
    'payment', 'due', 'renewal', 'appointment', 'meeting', 'flight',
    'train', 'delivery', 'school', 'exam', 'medicine', 'reservation',
    'confirmed', 'cancelled', 'delayed', 'arriving', 'debit', 'credit',
  ];

  // Low relevance keywords
  private static LOW_RELEVANCE_KEYWORDS = [
    'like', 'follow', 'new video', 'promotion', 'sale', 'offer',
    'recommendation', 'trending', 'watch now', 'download', 'update available',
  ];

  /**
   * Classify notification through multi-stage pipeline
   */
  static classify(notification: NormalizedNotification): NotificationClassification {
    const reasons: string[] = [];
    let confidence = 0.5; // Start with medium confidence

    // Stage 1: Rule-based classification
    const ruleResult = this.classifyByRules(notification);
    reasons.push(...ruleResult.reasons);
    
    // Stage 2: App intelligence
    const appResult = this.classifyByApp(notification);
    reasons.push(...appResult.reasons);
    
    // Stage 3: Content analysis
    const contentResult = this.classifyByContent(notification);
    reasons.push(...contentResult.reasons);
    
    // Determine final classification
    const category = appResult.category || contentResult.category;
    const intent = this.determineIntent(notification, category);
    const action = this.determineAction(intent);
    
    // Calculate relevance
    const relevance = this.determineRelevance(
      ruleResult,
      appResult,
      contentResult
    );
    
    // Calculate priority (0-1)
    const priority = this.calculatePriority(
      relevance,
      category,
      intent,
      notification
    );
    
    // Calculate final confidence
    confidence = this.calculateConfidence(
      ruleResult.confidence,
      appResult.confidence,
      contentResult.confidence
    );

    return {
      relevance,
      category,
      intent,
      action,
      priority,
      confidence,
      reasons,
    };
  }

  /**
   * Stage 1: Rule-based classification
   */
  private static classifyByRules(
    notification: NormalizedNotification
  ): { 
    relevance: NotificationRelevance;
    confidence: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const text = `${notification.title} ${notification.body}`.toLowerCase();

    // Check for OTP (always irrelevant for context graph)
    if (/\b\d{4,8}\b/.test(text) && 
        /(otp|code|verification|password)/i.test(text)) {
      return {
        relevance: NotificationRelevance.SENSITIVE,
        confidence: 0.99,
        reasons: ['Contains OTP code'],
      };
    }

    // Check for system notifications
    if (notification.sourceApp.startsWith('android.') ||
        notification.sourceApp.startsWith('com.android.')) {
      return {
        relevance: NotificationRelevance.IRRELEVANT,
        confidence: 0.95,
        reasons: ['System notification'],
      };
    }

    // Check for high relevance keywords
    const hasHighRelevance = this.HIGH_RELEVANCE_KEYWORDS.some(keyword =>
      text.includes(keyword)
    );
    if (hasHighRelevance) {
      reasons.push('Contains high-relevance keyword');
      return {
        relevance: NotificationRelevance.RELEVANT,
        confidence: 0.8,
        reasons,
      };
    }

    // Check for low relevance keywords
    const hasLowRelevance = this.LOW_RELEVANCE_KEYWORDS.some(keyword =>
      text.includes(keyword)
    );
    if (hasLowRelevance) {
      reasons.push('Contains low-relevance keyword');
      return {
        relevance: NotificationRelevance.IRRELEVANT,
        confidence: 0.75,
        reasons,
      };
    }

    return {
      relevance: NotificationRelevance.UNKNOWN,
      confidence: 0.5,
      reasons: ['No matching rules'],
    };
  }

  /**
   * Stage 2: App-based classification
   */
  private static classifyByApp(
    notification: NormalizedNotification
  ): {
    category: NotificationCategory;
    confidence: number;
    reasons: string[];
  } {
    const packageName = notification.sourceApp.toLowerCase();
    const reasons: string[] = [];

    // Check app registry
    for (const [pattern, config] of Object.entries(this.APP_REGISTRY)) {
      if (packageName.includes(pattern)) {
        reasons.push(`Matched app pattern: ${pattern}`);
        return {
          category: config.domain,
          confidence: 0.85,
          reasons,
        };
      }
    }

    return {
      category: NotificationCategory.OTHER,
      confidence: 0.3,
      reasons: ['No app match found'],
    };
  }

  /**
   * Stage 3: Content-based classification
   */
  private static classifyByContent(
    notification: NormalizedNotification
  ): {
    category: NotificationCategory;
    confidence: number;
    reasons: string[];
  } {
    const text = `${notification.title} ${notification.body}`.toLowerCase();
    const reasons: string[] = [];

    // Finance keywords
    if (/(bill|payment|due|transaction|credit|debit|balance|emi|loan)/i.test(text)) {
      reasons.push('Finance keywords detected');
      return {
        category: NotificationCategory.FINANCE,
        confidence: 0.75,
        reasons,
      };
    }

    // Health keywords
    if (/(appointment|doctor|hospital|medicine|prescription|health)/i.test(text)) {
      reasons.push('Health keywords detected');
      return {
        category: NotificationCategory.HEALTH,
        confidence: 0.75,
        reasons,
      };
    }

    // Travel keywords
    if (/(flight|train|booking|journey|ticket|travel|ride)/i.test(text)) {
      reasons.push('Travel keywords detected');
      return {
        category: NotificationCategory.TRAVEL,
        confidence: 0.75,
        reasons,
      };
    }

    // Delivery keywords
    if (/(delivery|order|shipped|arriving|delivered|package)/i.test(text)) {
      reasons.push('Delivery keywords detected');
      return {
        category: NotificationCategory.DELIVERY,
        confidence: 0.75,
        reasons,
      };
    }

    return {
      category: NotificationCategory.OTHER,
      confidence: 0.4,
      reasons: ['Content-based classification inconclusive'],
    };
  }

  /**
   * Determine notification intent
   */
  private static determineIntent(
    notification: NormalizedNotification,
    category: NotificationCategory
  ): NotificationIntent {
    const text = `${notification.title} ${notification.body}`.toLowerCase();

    // Bill due
    if (/(bill|payment).*due/i.test(text)) {
      return NotificationIntent.BILL_DUE;
    }

    // Payment
    if (/(paid|payment|transaction|debit|credit)/i.test(text)) {
      return NotificationIntent.PAYMENT;
    }

    // Delivery
    if (/(delivery|arriving|shipped|out for delivery)/i.test(text)) {
      return NotificationIntent.DELIVERY;
    }

    // Appointment
    if (/(appointment|meeting|scheduled|booking)/i.test(text)) {
      return NotificationIntent.APPOINTMENT;
    }

    // Travel
    if (/(flight|train|journey|ride|trip)/i.test(text)) {
      return NotificationIntent.TRAVEL;
    }

    // Security alert
    if (/(security|alert|suspicious|login|verification)/i.test(text)) {
      return NotificationIntent.SECURITY_ALERT;
    }

    // Promotion
    if (/(offer|sale|discount|deal|promotion)/i.test(text)) {
      return NotificationIntent.PROMOTION;
    }

    // Reminder
    if (/(reminder|don't forget|remember)/i.test(text)) {
      return NotificationIntent.REMINDER;
    }

    return NotificationIntent.OTHER;
  }

  /**
   * Determine required action
   */
  private static determineAction(intent: NotificationIntent): NotificationAction {
    const actionMap: Record<NotificationIntent, NotificationAction> = {
      [NotificationIntent.BILL_DUE]: NotificationAction.PAY,
      [NotificationIntent.PAYMENT]: NotificationAction.REVIEW,
      [NotificationIntent.DELIVERY]: NotificationAction.TRACK,
      [NotificationIntent.APPOINTMENT]: NotificationAction.ATTEND,
      [NotificationIntent.TRAVEL]: NotificationAction.CONFIRM,
      [NotificationIntent.MESSAGE]: NotificationAction.RESPOND,
      [NotificationIntent.SECURITY_ALERT]: NotificationAction.REVIEW,
      [NotificationIntent.PROMOTION]: NotificationAction.READ,
      [NotificationIntent.REMINDER]: NotificationAction.REVIEW,
      [NotificationIntent.UPDATE]: NotificationAction.READ,
      [NotificationIntent.SOCIAL_INTERACTION]: NotificationAction.RESPOND,
      [NotificationIntent.OTHER]: NotificationAction.NONE,
    };

    return actionMap[intent] || NotificationAction.NONE;
  }

  /**
   * Determine overall relevance
   */
  private static determineRelevance(
    ruleResult: any,
    appResult: any,
    contentResult: any
  ): NotificationRelevance {
    // Priority to rule-based (highest confidence)
    if (ruleResult.relevance !== NotificationRelevance.UNKNOWN &&
        ruleResult.confidence >= 0.75) {
      return ruleResult.relevance;
    }

    // If app is highly relevant, mark as relevant
    if (appResult.confidence >= 0.8) {
      return NotificationRelevance.RELEVANT;
    }

    // If content is clearly financial/health/travel, mark as relevant
    if (contentResult.category !== NotificationCategory.OTHER &&
        contentResult.confidence >= 0.7) {
      return NotificationRelevance.RELEVANT;
    }

    return NotificationRelevance.UNKNOWN;
  }

  /**
   * Calculate priority score (0-1)
   */
  private static calculatePriority(
    relevance: NotificationRelevance,
    category: NotificationCategory,
    intent: NotificationIntent,
    notification: NormalizedNotification
  ): number {
    let priority = 0.5;

    // Relevance weight
    if (relevance === NotificationRelevance.RELEVANT) {
      priority += 0.2;
    } else if (relevance === NotificationRelevance.IRRELEVANT) {
      priority -= 0.3;
    }

    // Category weight
    const categoryWeights: Partial<Record<NotificationCategory, number>> = {
      [NotificationCategory.FINANCE]: 0.2,
      [NotificationCategory.HEALTH]: 0.25,
      [NotificationCategory.SECURITY]: 0.3,
      [NotificationCategory.TRAVEL]: 0.15,
      [NotificationCategory.WORK]: 0.15,
      [NotificationCategory.PROMOTION]: -0.2,
      [NotificationCategory.SOCIAL]: -0.1,
    };
    priority += categoryWeights[category] || 0;

    // Intent weight
    const intentWeights: Partial<Record<NotificationIntent, number>> = {
      [NotificationIntent.BILL_DUE]: 0.25,
      [NotificationIntent.SECURITY_ALERT]: 0.3,
      [NotificationIntent.APPOINTMENT]: 0.2,
      [NotificationIntent.PAYMENT]: 0.15,
      [NotificationIntent.PROMOTION]: -0.2,
    };
    priority += intentWeights[intent] || 0;

    // Urgency keywords
    const text = `${notification.title} ${notification.body}`.toLowerCase();
    if (/(urgent|immediate|now|today|due today|overdue)/i.test(text)) {
      priority += 0.2;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, priority));
  }

  /**
   * Calculate final confidence
   */
  private static calculateConfidence(
    ruleConfidence: number,
    appConfidence: number,
    contentConfidence: number
  ): number {
    // Weighted average with bias toward highest confidence
    const weights = [
      ruleConfidence >= 0.75 ? 0.5 : 0.2,
      appConfidence >= 0.8 ? 0.3 : 0.2,
      contentConfidence >= 0.7 ? 0.2 : 0.1,
    ];

    const total = ruleConfidence * weights[0] +
                  appConfidence * weights[1] +
                  contentConfidence * weights[2];

    return Math.max(0, Math.min(1, total));
  }
}
