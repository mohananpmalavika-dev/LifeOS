/**
 * Notification Normalizer
 * 
 * Normalizes notification content from different apps into consistent format.
 * Handles Unicode, currency, dates, phone numbers, URLs, etc.
 */

export interface RawNotification {
  id: string;
  packageName: string;
  appName?: string;
  title?: string;
  text?: string;
  subText?: string;
  timestamp: number;
  category?: string;
  channelId?: string;
  priority?: number;
}

export interface NormalizedNotification {
  id: string;
  sourceApp: string;
  appName: string;
  title: string;
  body: string;
  timestamp: Date;
  category?: string;
  priority: number;
  rawData: RawNotification;
}

export class NotificationNormalizer {
  /**
   * Normalize a raw notification
   */
  static normalize(raw: RawNotification): NormalizedNotification {
    return {
      id: raw.id,
      sourceApp: raw.packageName,
      appName: this.normalizeAppName(raw.appName, raw.packageName),
      title: this.normalizeText(raw.title || ''),
      body: this.normalizeText(this.combineText(raw)),
      timestamp: new Date(raw.timestamp),
      category: raw.category,
      priority: raw.priority || 0,
      rawData: raw,
    };
  }

  /**
   * Combine text, subText, and title into single body
   */
  private static combineText(raw: RawNotification): string {
    const parts: string[] = [];
    
    if (raw.text) parts.push(raw.text);
    if (raw.subText) parts.push(raw.subText);
    
    return parts.join(' ');
  }

  /**
   * Normalize app name
   */
  private static normalizeAppName(appName: string | undefined, packageName: string): string {
    if (appName) return appName;
    
    // Extract app name from package (e.g., 'com.whatsapp' -> 'WhatsApp')
    const parts = packageName.split('.');
    const name = parts[parts.length - 1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Normalize text content
   */
  private static normalizeText(text: string): string {
    if (!text) return '';

    let normalized = text;

    // Normalize Unicode
    normalized = normalized.normalize('NFKC');

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    normalized = normalized.trim();

    // Normalize quotes
    normalized = normalized.replace(/[""]/g, '"');
    normalized = normalized.replace(/['']/g, "'");

    // Normalize ellipsis
    normalized = normalized.replace(/…/g, '...');

    return normalized;
  }

  /**
   * Normalize currency amounts
   */
  static normalizeCurrency(text: string): { value: number; currency: string } | null {
    const patterns = [
      // ₹2,431 or ₹ 2,431
      { regex: /₹\s*([\d,]+(?:\.\d{2})?)/g, currency: 'INR' },
      // Rs. 2,431 or Rs 2431
      { regex: /Rs\.?\s*([\d,]+(?:\.\d{2})?)/gi, currency: 'INR' },
      // INR 2431
      { regex: /INR\s*([\d,]+(?:\.\d{2})?)/gi, currency: 'INR' },
      // $2,431
      { regex: /\$\s*([\d,]+(?:\.\d{2})?)/g, currency: 'USD' },
      // USD 2431
      { regex: /USD\s*([\d,]+(?:\.\d{2})?)/gi, currency: 'USD' },
    ];

    for (const pattern of patterns) {
      const match = pattern.regex.exec(text);
      if (match) {
        const valueStr = match[1].replace(/,/g, '');
        const value = parseFloat(valueStr);
        if (!isNaN(value)) {
          return { value, currency: pattern.currency };
        }
      }
    }

    return null;
  }

  /**
   * Normalize dates - resolve relative dates to absolute
   */
  static normalizeDate(text: string, referenceDate: Date = new Date()): Date | null {
    const lowerText = text.toLowerCase();

    // Today
    if (lowerText.includes('today')) {
      return new Date(referenceDate);
    }

    // Tomorrow
    if (lowerText.includes('tomorrow')) {
      const tomorrow = new Date(referenceDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    // Yesterday
    if (lowerText.includes('yesterday')) {
      const yesterday = new Date(referenceDate);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Day of week (e.g., "Friday")
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lowerText.includes(days[i])) {
        return this.getNextDayOfWeek(referenceDate, i);
      }
    }

    // Date patterns (e.g., "14 Aug", "Aug 14", "14/08", "2026-08-14")
    const datePatterns = [
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i,
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of datePatterns) {
      const match = pattern.exec(text);
      if (match) {
        return this.parseMatchedDate(match, referenceDate);
      }
    }

    return null;
  }

  /**
   * Get next occurrence of day of week
   */
  private static getNextDayOfWeek(referenceDate: Date, targetDay: number): Date {
    const result = new Date(referenceDate);
    const currentDay = result.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) {
      daysToAdd += 7; // Next week
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  /**
   * Parse matched date pattern
   */
  private static parseMatchedDate(match: RegExpExecArray, referenceDate: Date): Date | null {
    try {
      // ISO format: YYYY-MM-DD
      if (match[0].includes('-') && match[1].length === 4) {
        return new Date(`${match[1]}-${match[2]}-${match[3]}`);
      }

      // DD/MM or DD/MM/YY
      if (match[0].includes('/')) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JS months are 0-indexed
        const year = match[3] 
          ? (parseInt(match[3]) < 100 ? 2000 + parseInt(match[3]) : parseInt(match[3]))
          : referenceDate.getFullYear();
        return new Date(year, month, day);
      }

      // DD Mon or Mon DD
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthStr = (match[1].length > 2 ? match[1] : match[2]).toLowerCase().substring(0, 3);
      const day = parseInt(match[1].length <= 2 ? match[1] : match[2]);
      const month = monthNames.indexOf(monthStr);
      
      if (month >= 0) {
        const year = referenceDate.getFullYear();
        const result = new Date(year, month, day);
        
        // If date is in the past, assume next year
        if (result < referenceDate) {
          result.setFullYear(year + 1);
        }
        
        return result;
      }

    } catch (error) {
      console.error('Date parsing error:', error);
    }

    return null;
  }

  /**
   * Extract phone numbers
   */
  static extractPhoneNumbers(text: string): string[] {
    const patterns = [
      /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g,  // International
      /\d{10}/g,  // 10-digit
    ];

    const phoneNumbers: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        phoneNumbers.push(...matches);
      }
    }

    return [...new Set(phoneNumbers)]; // Remove duplicates
  }

  /**
   * Extract URLs
   */
  static extractUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const matches = text.match(urlPattern);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract numbers
   */
  static extractNumbers(text: string): number[] {
    // Match numbers with optional commas and decimals
    const numberPattern = /\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/g;
    const matches = text.match(numberPattern);
    if (!matches) return [];

    return matches
      .map(match => parseFloat(match.replace(/,/g, '')))
      .filter(num => !isNaN(num));
  }

  /**
   * Detect time mentions
   */
  static extractTime(text: string): string | null {
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,  // 3:30 PM
      /(\d{1,2})\s*(am|pm)/i,          // 3 PM
      /(\d{2}):(\d{2})/,                // 14:30 (24-hour)
    ];

    for (const pattern of timePatterns) {
      const match = pattern.exec(text);
      if (match) {
        return match[0];
      }
    }

    return null;
  }
}
