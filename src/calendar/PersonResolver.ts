/**
 * Person Resolver
 * 
 * Resolves calendar attendees to known person entities with confidence scoring
 */

import { PersonReference, ResolvedPerson } from './types';
import Database from 'better-sqlite3';

interface PersonEntity {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  relationship?: string;
}

export class PersonResolver {
  constructor(private db: Database.Database) {}
  
  /**
   * Resolve a person reference to a known entity
   */
  async resolve(reference: PersonReference): Promise<ResolvedPerson | null> {
    if (!reference.email && !reference.name && !reference.phone) {
      return null;
    }
    
    // Try exact email match first (highest confidence)
    if (reference.email) {
      const byEmail = this.findByEmail(reference.email);
      if (byEmail) {
        return {
          personId: byEmail.id,
          name: byEmail.name,
          email: byEmail.email,
          phone: byEmail.phone,
          organization: byEmail.organization,
          relationship: byEmail.relationship,
          confidence: 0.97
        };
      }
    }
    
    // Try exact phone match
    if (reference.phone) {
      const byPhone = this.findByPhone(reference.phone);
      if (byPhone) {
        return {
          personId: byPhone.id,
          name: byPhone.name,
          email: byPhone.email,
          phone: byPhone.phone,
          organization: byPhone.organization,
          relationship: byPhone.relationship,
          confidence: 0.95
        };
      }
    }
    
    // Try name matching (lower confidence)
    if (reference.name) {
      const byName = this.findByName(reference.name);
      if (byName) {
        // If email also matches, increase confidence
        let confidence = 0.75;
        if (reference.email && byName.email === reference.email) {
          confidence = 0.97;
        }
        
        return {
          personId: byName.id,
          name: byName.name,
          email: byName.email,
          phone: byName.phone,
          organization: byName.organization,
          relationship: byName.relationship,
          confidence
        };
      }
    }
    
    // Try fuzzy name matching
    if (reference.name) {
      const fuzzyMatch = this.findByFuzzyName(reference.name);
      if (fuzzyMatch) {
        return {
          personId: fuzzyMatch.id,
          name: fuzzyMatch.name,
          email: fuzzyMatch.email,
          phone: fuzzyMatch.phone,
          organization: fuzzyMatch.organization,
          relationship: fuzzyMatch.relationship,
          confidence: 0.65
        };
      }
    }
    
    // No match found - create new person entity
    const newPerson = this.createPerson(reference);
    return {
      personId: newPerson.id,
      name: reference.name || reference.email || 'Unknown',
      email: reference.email,
      phone: reference.phone,
      confidence: 0.5 // Low confidence for new entity
    };
  }
  
  /**
   * Resolve multiple people
   */
  async resolveMultiple(references: PersonReference[]): Promise<ResolvedPerson[]> {
    const resolved: ResolvedPerson[] = [];
    
    for (const ref of references) {
      const person = await this.resolve(ref);
      if (person) {
        resolved.push(person);
      }
    }
    
    return resolved;
  }
  
  /**
   * Find person by email
   */
  private findByEmail(email: string): PersonEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'email' THEN ea.value END) as email,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'phone' THEN ea.value END) as phone,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'organization' THEN ea.value END) as organization,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'relationship' THEN ea.value END) as relationship
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PERSON'
        AND e.entity_id IN (
          SELECT entity_id FROM entity_attributes 
          WHERE attribute_type = 'email' 
          AND LOWER(value) = LOWER(?)
        )
        GROUP BY e.entity_id
        LIMIT 1
      `).get(email) as PersonEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding person by email:', error);
      return null;
    }
  }
  
  /**
   * Find person by phone
   */
  private findByPhone(phone: string): PersonEntity | null {
    try {
      const normalizedPhone = this.normalizePhone(phone);
      
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'email' THEN ea.value END) as email,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'phone' THEN ea.value END) as phone,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'organization' THEN ea.value END) as organization,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'relationship' THEN ea.value END) as relationship
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PERSON'
        AND e.entity_id IN (
          SELECT entity_id FROM entity_attributes 
          WHERE attribute_type = 'phone' 
          AND REPLACE(REPLACE(REPLACE(value, '-', ''), ' ', ''), '+', '') = ?
        )
        GROUP BY e.entity_id
        LIMIT 1
      `).get(normalizedPhone) as PersonEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding person by phone:', error);
      return null;
    }
  }
  
  /**
   * Find person by exact name
   */
  private findByName(name: string): PersonEntity | null {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'email' THEN ea.value END) as email,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'phone' THEN ea.value END) as phone,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'organization' THEN ea.value END) as organization,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'relationship' THEN ea.value END) as relationship
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PERSON'
        AND LOWER(e.name) = LOWER(?)
        GROUP BY e.entity_id
        LIMIT 1
      `).get(name) as PersonEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding person by name:', error);
      return null;
    }
  }
  
  /**
   * Find person by fuzzy name matching
   */
  private findByFuzzyName(name: string): PersonEntity | null {
    try {
      // Simple fuzzy matching: check if names contain each other
      const nameParts = name.toLowerCase().split(' ').filter(p => p.length > 2);
      
      if (nameParts.length === 0) return null;
      
      const conditions = nameParts.map(() => 'LOWER(e.name) LIKE ?').join(' OR ');
      const params = nameParts.map(part => `%${part}%`);
      
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as id,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'email' THEN ea.value END) as email,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'phone' THEN ea.value END) as phone,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'organization' THEN ea.value END) as organization,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'relationship' THEN ea.value END) as relationship
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PERSON'
        AND (${conditions})
        GROUP BY e.entity_id
        LIMIT 1
      `).get(...params) as PersonEntity | undefined;
      
      return result || null;
    } catch (error) {
      console.error('Error finding person by fuzzy name:', error);
      return null;
    }
  }
  
  /**
   * Create new person entity
   */
  private createPerson(reference: PersonReference): PersonEntity {
    const entityId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = reference.name || reference.email || 'Unknown';
    
    try {
      // Insert person entity
      this.db.prepare(`
        INSERT INTO entities (entity_id, entity_type, name, created_at)
        VALUES (?, 'PERSON', ?, datetime('now'))
      `).run(entityId, name);
      
      // Insert attributes
      if (reference.email) {
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'email', ?, 0.9)
        `).run(entityId, reference.email);
      }
      
      if (reference.phone) {
        this.db.prepare(`
          INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'phone', ?, 0.9)
        `).run(entityId, reference.phone);
      }
      
      // Extract organization from email domain
      if (reference.email && reference.email.includes('@')) {
        const domain = reference.email.split('@')[1];
        const organization = this.extractOrganizationFromDomain(domain);
        
        if (organization) {
          this.db.prepare(`
            INSERT INTO entity_attributes (entity_id, attribute_type, value, confidence)
            VALUES (?, 'organization', ?, 0.7)
          `).run(entityId, organization);
        }
      }
      
      return {
        id: entityId,
        name,
        email: reference.email,
        phone: reference.phone
      };
    } catch (error) {
      console.error('Error creating person entity:', error);
      throw error;
    }
  }
  
  /**
   * Extract organization name from email domain
   */
  private extractOrganizationFromDomain(domain: string): string | null {
    // Remove common TLDs
    const name = domain.replace(/\.(com|org|net|edu|gov|co\.\w+)$/i, '');
    
    // Skip common personal email providers
    const personalDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'aol'];
    if (personalDomains.includes(name.toLowerCase())) {
      return null;
    }
    
    // Capitalize first letter of each word
    return name
      .split(/[.-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Normalize phone number for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[-\s+()]/g, '');
  }
  
  /**
   * Update person entity with new information
   */
  async updatePerson(personId: string, updates: Partial<PersonReference>): Promise<void> {
    try {
      if (updates.email) {
        this.db.prepare(`
          INSERT OR REPLACE INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'email', ?, 0.9)
        `).run(personId, updates.email);
      }
      
      if (updates.phone) {
        this.db.prepare(`
          INSERT OR REPLACE INTO entity_attributes (entity_id, attribute_type, value, confidence)
          VALUES (?, 'phone', ?, 0.9)
        `).run(personId, updates.phone);
      }
      
      if (updates.name) {
        this.db.prepare(`
          UPDATE entities SET name = ? WHERE entity_id = ?
        `).run(updates.name, personId);
      }
    } catch (error) {
      console.error('Error updating person entity:', error);
      throw error;
    }
  }
  
  /**
   * Get person interaction history for importance scoring
   */
  getInteractionHistory(personId: string): {
    totalInteractions: number;
    recentInteractions: number;
    lastInteractionDate: string | null;
  } {
    try {
      const result = this.db.prepare(`
        SELECT 
          COUNT(*) as totalInteractions,
          SUM(CASE WHEN timestamp > datetime('now', '-30 days') THEN 1 ELSE 0 END) as recentInteractions,
          MAX(timestamp) as lastInteractionDate
        FROM life_events
        WHERE event_type IN ('CALENDAR_EVENT', 'NOTIFICATION', 'COMMUNICATION')
        AND json_extract(metadata, '$.personId') = ?
      `).get(personId) as any;
      
      return {
        totalInteractions: result?.totalInteractions || 0,
        recentInteractions: result?.recentInteractions || 0,
        lastInteractionDate: result?.lastInteractionDate || null
      };
    } catch (error) {
      console.error('Error getting interaction history:', error);
      return {
        totalInteractions: 0,
        recentInteractions: 0,
        lastInteractionDate: null
      };
    }
  }
}
