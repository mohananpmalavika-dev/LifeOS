/**
 * Notification Entity Extractor
 * 
 * Extracts structured entities from notifications:
 * - Amounts and currency
 * - Dates and times
 * - Organizations
 * - Actions
 * - Locations
 */

import { NotificationNormalizer } from './NotificationNormalizer';
import type { NormalizedNotification } from './NotificationNormalizer';
import type { NotificationCategory, NotificationIntent } from './NotificationClassifier';

export interface ExtractedEntity {
  type: EntityType;
  value: any;
  confidence: number;
  rawText?: string;
}

export enum EntityType {
  AMOUNT = 'AMOUNT',
  CURRENCY = 'CURRENCY',
  DATE = 'DATE',
  TIME = 'TIME',
  ORGANIZATION = 'ORGANIZATION',
  PERSON = 'PERSON',
  LOCATION = 'LOCATION',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  URL = 'URL',
  ACTION = 'ACTION',
  ACCOUNT = 'ACCOUNT',
  ORDER_ID = 'ORDER_ID',
  TRACKING = 'TRACKING',
}

export interface StructuredNotificationData {
  // Core entities
  entities: ExtractedEntity[];
  
  // Specific extracted fields
  amount?: {
    value: number;
    currency: string;
    confidence: number;
  };
  dueDate?: {
    value: string; // ISO 8601
    confidence: number;
  };
  organization?: {
    name: string;
    confidence: number;
  };
  action?: {
    type: string;
    confidence: number;
  };
  
  // Metadata
  hasAmountInfo: boolean;
  hasDateInfo: boolean;
  hasActionInfo: boolean;
}

export class NotificationEntityExtractor {
  /**
   * Extract all entities from notification
   */
  static extract(
    notification: NormalizedNotification,
    category: NotificationCategory,
    intent: NotificationIntent
  ): StructuredNotificationData {
    const fullText = `${notification.title} ${notification.body}`;
    const entities: ExtractedEntity[] = [];
    
    // Extract amount and currency
    const amountEntity = this.extractAmount(fullText);
    if (amountEntity) {
      entities.push(amountEntity);
    }
    
    // Extract dates
    const dateEntities = this.extractDates(fullText);
    entities.push(...dateEntities);
    
    // Extract times
    const timeEntity = this.extractTime(fullText);
    if (timeEntity) {
      entities.push(timeEntity);
    }
    
    // Extract organization/merchant
    const orgEntity = this.extractOrganization(fullText, notification.appName);
    if (orgEntity) {
      entities.push(orgEntity);
    }
    
    // Extract phone numbers
    const phoneEntities = this.extractPhones(fullText);
    entities.push(...phoneEntities);
    
    // Extract URLs
    const urlEntities = this.extractUrls(fullText);
    entities.push(...urlEntities);
    
    // Extract account numbers (last 4 digits)
    const accountEntity = this.extractAccount(fullText);
    if (accountEntity) {
      entities.push(accountEntity);
    }
    
    // Extract order/tracking IDs
    const orderEntity = this.extractOrderId(fullText);
    if (orderEntity) {
      entities.push(orderEntity);
    }
    
    // Extract action
    const actionEntity = this.extractAction(fullText, intent);
    if (actionEntity) {
      entities.push(actionEntity);
    }
    
    // Build structured data
    return this.buildStructuredData(entities);
  }

  /**
   * Extract amount and currency
   */
  private static extractAmount(text: string): ExtractedEntity | null {
    const currency = NotificationNormalizer.normalizeCurrency(text);
    if (!currency) return null;

    return {
      type: EntityType.AMOUNT,
      value: {
        amount: currency.value,
        currency: currency.currency,
      },
      confidence: 0.95,
      rawText: text.match(/[₹$]\s*[\d,]+(?:\.\d{2})?/)?.[0],
    };
  }

  /**
   * Extract dates
   */
  private static extractDates(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const now = new Date();
    
    // Try to extract dates
    const datePatterns = [
      'today', 'tomorrow', 'yesterday',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ];
    
    for (const pattern of datePatterns) {
      if (text.toLowerCase().includes(pattern)) {
        const date = NotificationNormalizer.normalizeDate(pattern, now);
        if (date) {
          entities.push({
            type: EntityType.DATE,
            value: date.toISOString().split('T')[0], // YYYY-MM-DD
            confidence: 0.85,
            rawText: pattern,
          });
          break; // Take first match
        }
      }
    }
    
    // Try explicit date formats
    if (entities.length === 0) {
      const dateMatch = text.match(/(\d{1,2})[\s\/-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\/-]*(\d{2,4})?/i);
      if (dateMatch) {
        const date = NotificationNormalizer.normalizeDate(dateMatch[0], now);
        if (date) {
          entities.push({
            type: EntityType.DATE,
            value: date.toISOString().split('T')[0],
            confidence: 0.9,
            rawText: dateMatch[0],
          });
        }
      }
    }
    
    return entities;
  }

  /**
   * Extract time
   */
  private static extractTime(text: string): ExtractedEntity | null {
    const time = NotificationNormalizer.extractTime(text);
    if (!time) return null;

    return {
      type: EntityType.TIME,
      value: time,
      confidence: 0.9,
      rawText: time,
    };
  }

  /**
   * Extract organization/merchant name
   */
  private static extractOrganization(text: string, appName: string): ExtractedEntity | null {
    // Common patterns for organization names
    const patterns = [
      // "from <Name>"
      /from\s+([A-Z][a-zA-Z\s&]+?)(?:\s+is|\s+has|\s+on|\.|$)/i,
      // "<Name> bill"
      /([A-Z][a-zA-Z\s&]+?)\s+bill/i,
      // "Your <Name> account"
      /your\s+([A-Z][a-zA-Z\s&]+?)\s+account/i,
      // "at <Name>"
      /at\s+([A-Z][a-zA-Z\s&]+?)(?:\s+is|\s+has|\s+on|\.|$)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const name = match[1].trim();
        // Filter out common words
        if (name.length > 2 && 
            !['Your', 'The', 'This', 'That', 'From', 'For'].includes(name)) {
          return {
            type: EntityType.ORGANIZATION,
            value: name,
            confidence: 0.75,
            rawText: name,
          };
        }
      }
    }

    // Fallback: use app name if it looks like an organization
    if (appName && appName !== 'Unknown' && appName.length > 3) {
      return {
        type: EntityType.ORGANIZATION,
        value: appName,
        confidence: 0.6,
        rawText: appName,
      };
    }

    return null;
  }

  /**
   * Extract phone numbers
   */
  private static extractPhones(text: string): ExtractedEntity[] {
    const phones = NotificationNormalizer.extractPhoneNumbers(text);
    return phones.map(phone => ({
      type: EntityType.PHONE,
      value: phone,
      confidence: 0.85,
      rawText: phone,
    }));
  }

  /**
   * Extract URLs
   */
  private static extractUrls(text: string): ExtractedEntity[] {
    const urls = NotificationNormalizer.extractUrls(text);
    return urls.map(url => ({
      type: EntityType.URL,
      value: url,
      confidence: 0.95,
      rawText: url,
    }));
  }

  /**
   * Extract account number (usually last 4 digits)
   */
  private static extractAccount(text: string): ExtractedEntity | null {
    const patterns = [
      /account\s+(?:ending\s+)?(\d{4})/i,
      /A\/C\s+[X*]+(\d{4})/i,
      /ending\s+(?:in\s+)?(\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        return {
          type: EntityType.ACCOUNT,
          value: match[1],
          confidence: 0.9,
          rawText: match[0],
        };
      }
    }

    return null;
  }

  /**
   * Extract order/tracking ID
   */
  private static extractOrderId(text: string): ExtractedEntity | null {
    const patterns = [
      /order\s+(?:id|#|number)?\s*:?\s*([A-Z0-9-]+)/i,
      /tracking\s+(?:id|#|number)?\s*:?\s*([A-Z0-9-]+)/i,
      /AWB\s*:?\s*([A-Z0-9-]+)/i,
      /booking\s+(?:id|#|number)?\s*:?\s*([A-Z0-9-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && match[1].length >= 6) {
        return {
          type: EntityType.TRACKING,
          value: match[1],
          confidence: 0.85,
          rawText: match[0],
        };
      }
    }

    return null;
  }

  /**
   * Extract action based on intent and text
   */
  private static extractAction(text: string, intent: NotificationIntent): ExtractedEntity | null {
    const actionKeywords: Record<string, string[]> = {
      'PAY': ['pay', 'payment', 'settle', 'clear'],
      'CONFIRM': ['confirm', 'verify', 'approve'],
      'REVIEW': ['review', 'check', 'view'],
      'RESPOND': ['reply', 'respond', 'answer'],
      'ATTEND': ['attend', 'join', 'participate'],
      'TRACK': ['track', 'follow', 'monitor'],
      'SCHEDULE': ['schedule', 'book', 'reserve'],
    };

    const lowerText = text.toLowerCase();
    
    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return {
          type: EntityType.ACTION,
          value: action,
          confidence: 0.8,
          rawText: keywords.find(k => lowerText.includes(k)),
        };
      }
    }

    return null;
  }

  /**
   * Build structured data from entities
   */
  private static buildStructuredData(entities: ExtractedEntity[]): StructuredNotificationData {
    const data: StructuredNotificationData = {
      entities,
      hasAmountInfo: false,
      hasDateInfo: false,
      hasActionInfo: false,
    };

    // Extract specific high-level fields
    for (const entity of entities) {
      switch (entity.type) {
        case EntityType.AMOUNT:
          data.amount = {
            value: entity.value.amount,
            currency: entity.value.currency,
            confidence: entity.confidence,
          };
          data.hasAmountInfo = true;
          break;
          
        case EntityType.DATE:
          if (!data.dueDate || entity.confidence > data.dueDate.confidence) {
            data.dueDate = {
              value: entity.value,
              confidence: entity.confidence,
            };
          }
          data.hasDateInfo = true;
          break;
          
        case EntityType.ORGANIZATION:
          if (!data.organization || entity.confidence > data.organization.confidence) {
            data.organization = {
              name: entity.value,
              confidence: entity.confidence,
            };
          }
          break;
          
        case EntityType.ACTION:
          if (!data.action || entity.confidence > data.action.confidence) {
            data.action = {
              type: entity.value,
              confidence: entity.confidence,
            };
          }
          data.hasActionInfo = true;
          break;
      }
    }

    return data;
  }

  /**
   * Validate extracted entities against expected intent
   */
  static validate(
    data: StructuredNotificationData,
    intent: NotificationIntent
  ): { valid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    // Check required fields based on intent
    switch (intent) {
      case 'BILL_DUE':
        if (!data.amount) missingFields.push('amount');
        if (!data.dueDate) missingFields.push('dueDate');
        if (!data.organization) missingFields.push('organization');
        break;
        
      case 'PAYMENT':
        if (!data.amount) missingFields.push('amount');
        break;
        
      case 'APPOINTMENT':
        if (!data.dueDate) missingFields.push('date');
        break;
        
      case 'DELIVERY':
        // Optional: tracking info
        break;
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }
}
