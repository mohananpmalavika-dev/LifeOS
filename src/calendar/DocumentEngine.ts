/**
 * Document Engine
 * 
 * Analyzes document requirements and matches with available documents
 */

import { 
  EnrichedCalendarEvent, 
  DocumentRequirement, 
  EventType 
} from './types.js';
import { EventClassifier } from './EventClassifier.js';
import Database from 'better-sqlite3';

interface StoredDocument {
  documentId: string;
  name: string;
  type: string;
  path?: string;
  expiryDate?: string;
  tags: string[];
}

export class DocumentEngine {
  constructor(
    private db: Database.Database,
    private eventClassifier: EventClassifier
  ) {}
  
  /**
   * Analyze document requirements for an event
   */
  analyzeDocumentRequirements(event: EnrichedCalendarEvent): DocumentRequirement[] {
    const requirements: DocumentRequirement[] = [];
    
    // Get recommended documents for event type
    const recommendedDocs = event.eventType
      ? this.eventClassifier.getRecommendedDocuments(event.eventType)
      : [];
    
    // Check each recommended document
    for (const docType of recommendedDocs) {
      const stored = this.findDocument(docType);
      const confidence = this.calculateRequirementConfidence(event, docType);
      
      requirements.push({
        type: docType,
        name: docType,
        required: confidence > 0.7,
        confidence,
        available: stored !== null,
        documentId: stored?.documentId
      });
    }
    
    // Add event-specific document requirements
    const specificDocs = this.getEventSpecificDocuments(event);
    requirements.push(...specificDocs);
    
    // Parse event description for document mentions
    const mentionedDocs = this.extractDocumentMentions(event.event.description || '');
    requirements.push(...mentionedDocs);
    
    // Remove duplicates
    const uniqueRequirements = this.deduplicateRequirements(requirements);
    
    return uniqueRequirements;
  }
  
  /**
   * Calculate confidence that a document is required
   */
  private calculateRequirementConfidence(event: EnrichedCalendarEvent, docType: string): number {
    let confidence = 0.5;
    
    // Check event type profile
    const profile = event.eventType
      ? this.eventClassifier.getProfile(event.eventType)
      : null;
    
    if (profile) {
      confidence = profile.documentLikelihood;
    }
    
    // Adjust based on event context
    const title = event.event.title?.toLowerCase() || '';
    const description = event.event.description?.toLowerCase() || '';
    const text = `${title} ${description}`;
    
    // Document-specific keywords
    const docKeywords: Record<string, string[]> = {
      'Passport': ['passport', 'international', 'visa', 'travel', 'flight', 'immigration'],
      'ID': ['id', 'identification', 'identity', 'verify'],
      'Medical Records': ['medical', 'health', 'doctor', 'hospital', 'records'],
      'Insurance Card': ['insurance', 'coverage', 'policy'],
      'Boarding Pass': ['boarding', 'flight', 'airline', 'check-in'],
      'Ticket': ['ticket', 'booking', 'reservation'],
      'Visa': ['visa', 'embassy', 'consulate'],
      'Hall Ticket': ['exam', 'test', 'hall ticket', 'admit card'],
      'Legal Documents': ['legal', 'contract', 'agreement', 'court'],
      'Bank Documents': ['bank', 'account', 'financial', 'statement']
    };
    
    const keywords = docKeywords[docType] || [];
    const mentionCount = keywords.filter(keyword => text.includes(keyword)).length;
    
    if (mentionCount > 0) {
      confidence = Math.min(0.95, confidence + (mentionCount * 0.15));
    }
    
    // Check historical requirements
    const historical = this.getHistoricalRequirement(event.eventType, docType);
    if (historical > 0) {
      confidence = (confidence + historical) / 2; // Average with historical data
    }
    
    return confidence;
  }
  
  /**
   * Get event-specific document requirements
   */
  private getEventSpecificDocuments(event: EnrichedCalendarEvent): DocumentRequirement[] {
    const docs: DocumentRequirement[] = [];
    
    // Check for work meetings requiring laptop/presentation
    if (event.eventType === EventType.WORK_MEETING) {
      const title = event.event.title?.toLowerCase() || '';
      const desc = event.event.description?.toLowerCase() || '';
      
      if (title.includes('presentation') || desc.includes('present') || desc.includes('demo')) {
        const laptop = this.findDocument('Laptop');
        docs.push({
          type: 'Laptop',
          name: 'Laptop',
          required: true,
          confidence: 0.9,
          available: laptop !== null,
          documentId: laptop?.documentId
        });
        
        const presentation = this.findDocument('Presentation');
        docs.push({
          type: 'Presentation',
          name: 'Presentation',
          required: true,
          confidence: 0.85,
          available: presentation !== null,
          documentId: presentation?.documentId
        });
      }
    }
    
    // Check place-specific requirements
    if (event.place) {
      const placeType = event.place.placeType;
      
      if (placeType === 'AIRPORT') {
        const passport = this.findDocument('Passport');
        docs.push({
          type: 'Passport',
          name: 'Passport',
          required: true,
          confidence: 0.95,
          available: passport !== null,
          documentId: passport?.documentId
        });
      }
      
      if (placeType === 'GOVERNMENT' || placeType === 'COURT') {
        const id = this.findDocument('ID');
        docs.push({
          type: 'ID',
          name: 'Government ID',
          required: true,
          confidence: 0.9,
          available: id !== null,
          documentId: id?.documentId
        });
      }
    }
    
    return docs;
  }
  
  /**
   * Extract document mentions from text
   */
  private extractDocumentMentions(text: string): DocumentRequirement[] {
    const docs: DocumentRequirement[] = [];
    const lowerText = text.toLowerCase();
    
    const patterns = [
      { regex: /bring (?:your )?([a-z\s]+?)(?:\.|,|$)/gi, required: true },
      { regex: /need (?:your )?([a-z\s]+?)(?:\.|,|$)/gi, required: true },
      { regex: /required:?\s*([a-z\s,]+)/gi, required: true },
      { regex: /please (?:have|bring) ([a-z\s]+?)(?:\.|,|$)/gi, required: true }
    ];
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern.regex)];
      
      for (const match of matches) {
        const docName = match[1].trim();
        
        if (docName.length > 3 && docName.length < 50) {
          const stored = this.findDocumentByName(docName);
          
          docs.push({
            type: docName,
            name: docName,
            required: pattern.required,
            confidence: 0.75,
            available: stored !== null,
            documentId: stored?.documentId
          });
        }
      }
    }
    
    return docs;
  }
  
  /**
   * Remove duplicate requirements
   */
  private deduplicateRequirements(requirements: DocumentRequirement[]): DocumentRequirement[] {
    const seen = new Map<string, DocumentRequirement>();
    
    for (const req of requirements) {
      const key = req.type.toLowerCase();
      const existing = seen.get(key);
      
      if (!existing || req.confidence > existing.confidence) {
        seen.set(key, req);
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Find document in storage
   */
  private findDocument(docType: string): StoredDocument | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          document_id as documentId,
          name,
          type,
          path,
          expiry_date as expiryDate
        FROM documents
        WHERE LOWER(type) = LOWER(?)
        AND (expiry_date IS NULL OR expiry_date > datetime('now'))
        LIMIT 1
      `).get(docType) as StoredDocument | undefined;
      
      if (result) {
        result.tags = this.getDocumentTags(result.documentId);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding document:', error);
      return null;
    }
  }
  
  /**
   * Find document by name (fuzzy match)
   */
  private findDocumentByName(name: string): StoredDocument | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          document_id as documentId,
          name,
          type,
          path,
          expiry_date as expiryDate
        FROM documents
        WHERE LOWER(name) LIKE LOWER(?)
        AND (expiry_date IS NULL OR expiry_date > datetime('now'))
        LIMIT 1
      `).get(`%${name}%`) as StoredDocument | undefined;
      
      if (result) {
        result.tags = this.getDocumentTags(result.documentId);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding document by name:', error);
      return null;
    }
  }
  
  /**
   * Get document tags
   */
  private getDocumentTags(documentId: string): string[] {
    try {
      const results = this.db.prepare(`
        SELECT tag
        FROM document_tags
        WHERE document_id = ?
      `).all(documentId) as { tag: string }[];
      
      return results.map(r => r.tag);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get historical document requirement frequency
   */
  private getHistoricalRequirement(eventType: EventType | undefined, docType: string): number {
    if (!eventType) return 0;
    
    try {
      const result = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN json_extract(metadata, '$.documents') LIKE '%${docType}%' THEN 1 ELSE 0 END) as withDoc
        FROM life_events
        WHERE event_type = 'CALENDAR_EVENT'
        AND json_extract(metadata, '$.eventType') = ?
        AND timestamp > datetime('now', '-6 months')
      `).get(eventType) as { total: number; withDoc: number } | undefined;
      
      if (result && result.total > 5) {
        return result.withDoc / result.total;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Check for expiring documents
   */
  checkExpiringDocuments(requirements: DocumentRequirement[], withinDays: number = 30): DocumentRequirement[] {
    const expiring: DocumentRequirement[] = [];
    
    for (const req of requirements) {
      if (!req.available || !req.documentId) continue;
      
      try {
        const doc = this.db.prepare(`
          SELECT expiry_date as expiryDate
          FROM documents
          WHERE document_id = ?
        `).get(req.documentId) as { expiryDate?: string } | undefined;
        
        if (doc?.expiryDate) {
          const expiry = new Date(doc.expiryDate);
          const now = new Date();
          const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysUntilExpiry <= withinDays && daysUntilExpiry >= 0) {
            expiring.push(req);
          }
        }
      } catch (error) {
        console.error('Error checking document expiry:', error);
      }
    }
    
    return expiring;
  }
  
  /**
   * Get missing required documents
   */
  getMissingDocuments(requirements: DocumentRequirement[]): DocumentRequirement[] {
    return requirements.filter(req => req.required && !req.available);
  }
  
  /**
   * Register document usage for learning
   */
  registerDocumentUsage(eventType: EventType, documentType: string, wasRequired: boolean): void {
    try {
      this.db.prepare(`
        INSERT INTO document_usage_history (
          event_type,
          document_type,
          was_required,
          timestamp,
          created_at
        ) VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(eventType, documentType, wasRequired ? 1 : 0);
    } catch (error) {
      console.error('Error registering document usage:', error);
    }
  }
  
  /**
   * Suggest documents to add to system
   */
  suggestDocumentsToAdd(): string[] {
    // Common important documents that should be in the system
    const essentialDocs = [
      'Passport',
      'Driver License',
      'Government ID',
      'Health Insurance Card',
      'Medical Records',
      'Vaccination Certificate',
      'Bank Account Details',
      'Emergency Contacts'
    ];
    
    const missing: string[] = [];
    
    for (const docType of essentialDocs) {
      const exists = this.findDocument(docType);
      if (!exists) {
        missing.push(docType);
      }
    }
    
    return missing;
  }
}
