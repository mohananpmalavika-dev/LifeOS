/**
 * Privacy Filter
 * 
 * Classifies and filters notification content based on privacy sensitivity.
 * Critical: prevents OTPs, banking info, and other sensitive data from leaving device.
 */

import { SensitivityLevel } from '../core/LifeEvent';

export interface PrivacyClassification {
  sensitivity: SensitivityLevel;
  shouldRedact: boolean;
  localOnly: boolean;
  reason: string;
  category?: string;
}

export class PrivacyFilter {
  // Packages that should always be filtered
  private static SENSITIVE_PACKAGES = [
    'com.google.android.gms.auth', // Google authenticator
    'com.microsoft.authenticator',
    'com.authy.authy',
  ];

  // Banking/financial keywords
  private static FINANCIAL_KEYWORDS = [
    'bank', 'payment', 'card', 'transaction', 'balance',
    'credit', 'debit', 'account', 'transfer', 'wallet',
  ];

  // Healthcare keywords
  private static HEALTHCARE_KEYWORDS = [
    'health', 'medical', 'doctor', 'hospital', 'appointment',
    'prescription', 'medication', 'clinic',
  ];

  /**
   * Classify notification privacy level
   */
  static classifyNotification(
    packageName: string,
    appName: string,
    title: string | null,
    text: string | null
  ): PrivacyClassification {
    const lowerPackage = packageName.toLowerCase();
    const lowerApp = appName.toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    const lowerText = (text || '').toLowerCase();

    // Check for OTP
    if (this.containsOTP(text)) {
      return {
        sensitivity: SensitivityLevel.CRITICAL,
        shouldRedact: true,
        localOnly: true,
        reason: 'Contains OTP code',
        category: 'AUTHENTICATION',
      };
    }

    // Check for authentication apps
    if (this.SENSITIVE_PACKAGES.some(pkg => lowerPackage.includes(pkg))) {
      return {
        sensitivity: SensitivityLevel.CRITICAL,
        shouldRedact: true,
        localOnly: true,
        reason: 'Authentication app',
        category: 'AUTHENTICATION',
      };
    }

    // Check for financial content
    if (
      this.FINANCIAL_KEYWORDS.some(keyword => 
        lowerPackage.includes(keyword) ||
        lowerApp.includes(keyword) ||
        lowerTitle.includes(keyword) ||
        lowerText.includes(keyword)
      )
    ) {
      return {
        sensitivity: SensitivityLevel.SENSITIVE,
        shouldRedact: true,
        localOnly: false,
        reason: 'Financial content',
        category: 'FINANCIAL',
      };
    }

    // Check for healthcare content
    if (
      this.HEALTHCARE_KEYWORDS.some(keyword =>
        lowerPackage.includes(keyword) ||
        lowerApp.includes(keyword) ||
        lowerTitle.includes(keyword) ||
        lowerText.includes(keyword)
      )
    ) {
      return {
        sensitivity: SensitivityLevel.SENSITIVE,
        shouldRedact: true,
        localOnly: false,
        reason: 'Healthcare content',
        category: 'HEALTHCARE',
      };
    }

    // Messaging apps - configurable privacy
    if (this.isMessagingApp(lowerPackage)) {
      return {
        sensitivity: SensitivityLevel.PRIVATE,
        shouldRedact: false, // User can configure
        localOnly: false,
        reason: 'Messaging app',
        category: 'MESSAGING',
      };
    }

    // Email apps
    if (this.isEmailApp(lowerPackage)) {
      return {
        sensitivity: SensitivityLevel.PRIVATE,
        shouldRedact: false,
        localOnly: false,
        reason: 'Email app',
        category: 'EMAIL',
      };
    }

    // System notifications
    if (this.isSystemPackage(lowerPackage)) {
      return {
        sensitivity: SensitivityLevel.PUBLIC,
        shouldRedact: false,
        localOnly: false,
        reason: 'System notification',
        category: 'SYSTEM',
      };
    }

    // Default: private but not sensitive
    return {
      sensitivity: SensitivityLevel.PRIVATE,
      shouldRedact: false,
      localOnly: false,
      reason: 'Default classification',
      category: 'OTHER',
    };
  }

  /**
   * Check if text contains OTP code
   */
  private static containsOTP(text: string | null): boolean {
    if (!text) return false;

    // Common OTP patterns
    const otpPatterns = [
      /\b\d{4,8}\b/,                    // 4-8 digit codes
      /\b[A-Z0-9]{6}\b/,                // 6-character alphanumeric
      /\botp.*\d{4,8}/i,                // "OTP: 1234"
      /\bcode.*\d{4,8}/i,               // "Code: 1234"
      /\bverification.*\d{4,8}/i,       // "Verification: 1234"
      /\d{4,8}.*is your.*code/i,        // "1234 is your code"
    ];

    return otpPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if package is a messaging app
   */
  private static isMessagingApp(packageName: string): boolean {
    const messagingApps = [
      'whatsapp', 'telegram', 'signal', 'messenger',
      'sms', 'messages', 'wechat', 'viber', 'line',
    ];
    return messagingApps.some(app => packageName.includes(app));
  }

  /**
   * Check if package is an email app
   */
  private static isEmailApp(packageName: string): boolean {
    const emailApps = [
      'gmail', 'email', 'outlook', 'mail', 'yahoo',
    ];
    return emailApps.some(app => packageName.includes(app));
  }

  /**
   * Check if package is system package
   */
  private static isSystemPackage(packageName: string): boolean {
    return packageName.startsWith('android.') ||
           packageName.startsWith('com.android.');
  }

  /**
   * Redact sensitive content from notification
   */
  static redactNotification(
    title: string | null,
    text: string | null,
    classification: PrivacyClassification
  ): { title: string | null; text: string | null } {
    if (!classification.shouldRedact) {
      return { title, text };
    }

    // For critical content, redact everything
    if (classification.sensitivity === SensitivityLevel.CRITICAL) {
      return {
        title: '[REDACTED]',
        text: '[REDACTED]',
      };
    }

    // For sensitive content, keep structure but remove details
    if (classification.sensitivity === SensitivityLevel.SENSITIVE) {
      return {
        title: title ? `[${classification.category}]` : null,
        text: text ? '[Content redacted for privacy]' : null,
      };
    }

    return { title, text };
  }

  /**
   * Apply privacy settings from user preferences
   */
  static applyUserPreferences(
    classification: PrivacyClassification,
    userSettings: {
      shareMessaging?: boolean;
      shareEmail?: boolean;
      shareFinancial?: boolean;
    }
  ): PrivacyClassification {
    const settings = {
      shareMessaging: false,
      shareEmail: false,
      shareFinancial: false,
      ...userSettings,
    };

    // Override classification based on user preferences
    if (classification.category === 'MESSAGING' && !settings.shareMessaging) {
      return { ...classification, localOnly: true, shouldRedact: true };
    }

    if (classification.category === 'EMAIL' && !settings.shareEmail) {
      return { ...classification, localOnly: true, shouldRedact: true };
    }

    if (classification.category === 'FINANCIAL' && !settings.shareFinancial) {
      return { ...classification, localOnly: true, shouldRedact: true };
    }

    return classification;
  }
}
