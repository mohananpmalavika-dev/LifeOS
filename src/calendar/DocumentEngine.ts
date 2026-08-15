import { 
  EnrichedCalendarEvent, 
  DocumentRequirement, 
  EventType
} from './types.js';
import { EventClassifier } from './EventClassifier.js';
import Database from 'better-sqlite3';

export class DocumentEngine {
  constructor(
    private db: Database.Database,
    private eventClassifier: EventClassifier
  ) {
    this.initializeTables();
  }
  
  private initializeTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          document_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          path TEXT,
          expiry_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS document_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id TEXT NOT NULL,
          tag TEXT NOT NULL
        );
      `);
    } catch (e) {
      console.error('Error initializing document tables:', e);
    }
  }

  analyzeDocumentRequirements(event: EnrichedCalendarEvent): DocumentRequirement[] {
    const requirements: DocumentRequirement[] = [];
    const classification = event.eventType ? { type: event.eventType } : this.eventClassifier.classify(event.event);
    
    if (classification.type === EventType.MEDICAL_APPOINTMENT) {
      requirements.push(
        { type: 'HEALTH_INSURANCE', name: 'Health Insurance Policy Card', required: true, confidence: 0.95, available: true },
        { type: 'MEDICAL_RECORDS', name: 'Recent Lab & Blood Reports', required: true, confidence: 0.90, available: true }
      );
    } else if (classification.type === EventType.FLIGHT) {
      requirements.push(
        { type: 'PASSPORT', name: 'Passport / National ID', required: true, confidence: 0.98, available: true },
        { type: 'BOARDING_PASS', name: 'Boarding Pass / E-Ticket', required: true, confidence: 0.95, available: true }
      );
    } else if (classification.type === EventType.BANKING) {
      requirements.push(
        { type: 'ID_PROOF', name: 'Government Photo ID', required: true, confidence: 0.90, available: true }
      );
    }
    
    if (event.event.description) {
      const desc = event.event.description.toLowerCase();
      if (desc.includes('insurance') && !requirements.some(r => r.type === 'HEALTH_INSURANCE')) {
        requirements.push({ type: 'HEALTH_INSURANCE', name: 'Insurance Card', required: true, confidence: 0.9, available: true });
      }
      if ((desc.includes('report') || desc.includes('lab')) && !requirements.some(r => r.type === 'MEDICAL_RECORDS')) {
        requirements.push({ type: 'MEDICAL_RECORDS', name: 'Lab Reports', required: true, confidence: 0.85, available: true });
      }
    }
    
    return requirements;
  }
}
