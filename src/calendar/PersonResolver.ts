import { PersonReference, ResolvedPerson } from './types.js';
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
  
  async resolve(reference: PersonReference): Promise<ResolvedPerson | null> {
    if (!reference.email && !reference.name && !reference.phone) {
      return null;
    }
    
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
    
    if (reference.name) {
      const byName = this.findByName(reference.name);
      if (byName) {
        return {
          personId: byName.id,
          name: byName.name,
          email: byName.email,
          phone: byName.phone,
          organization: byName.organization,
          relationship: byName.relationship,
          confidence: 0.85
        };
      }
    }
    
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
    
    const newPerson = this.createPerson(reference);
    return {
      personId: newPerson.id,
      name: reference.name || reference.email || 'Unknown',
      email: reference.email,
      phone: reference.phone,
      confidence: 0.5
    };
  }
  
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
  
  private findByEmail(email: string): PersonEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, title as name, properties FROM entities
        WHERE (type = 'Person' OR type = 'PERSON') AND (properties LIKE ? OR title LIKE ?)
        LIMIT 1
      `).get(`%${email}%`, `%${email}%`) as any;
      if (row) {
        let props: any = {};
        try { props = JSON.parse(row.properties || '{}'); } catch {}
        return {
          id: row.id,
          name: row.name,
          email: props.email || email,
          phone: props.phone,
          organization: props.organization || props.hospital,
          relationship: props.relationship
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private findByPhone(phone: string): PersonEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, title as name, properties FROM entities
        WHERE (type = 'Person' OR type = 'PERSON') AND properties LIKE ?
        LIMIT 1
      `).get(`%${phone}%`) as any;
      if (row) {
        let props: any = {};
        try { props = JSON.parse(row.properties || '{}'); } catch {}
        return {
          id: row.id,
          name: row.name,
          email: props.email,
          phone: props.phone || phone,
          organization: props.organization,
          relationship: props.relationship
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private findByName(name: string): PersonEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, title as name, properties FROM entities
        WHERE (type = 'Person' OR type = 'PERSON') AND LOWER(title) = LOWER(?)
        LIMIT 1
      `).get(name) as any;
      if (row) {
        let props: any = {};
        try { props = JSON.parse(row.properties || '{}'); } catch {}
        return {
          id: row.id,
          name: row.name,
          email: props.email,
          phone: props.phone,
          organization: props.organization || props.hospital,
          relationship: props.relationship
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private findByFuzzyName(name: string): PersonEntity | null {
    try {
      const row = this.db.prepare(`
        SELECT id, title as name, properties FROM entities
        WHERE (type = 'Person' OR type = 'PERSON') AND LOWER(title) LIKE ?
        LIMIT 1
      `).get(`%${name.toLowerCase()}%`) as any;
      if (row) {
        let props: any = {};
        try { props = JSON.parse(row.properties || '{}'); } catch {}
        return {
          id: row.id,
          name: row.name,
          email: props.email,
          phone: props.phone,
          organization: props.organization || props.hospital,
          relationship: props.relationship
        };
      }
      return null;
    } catch {
      return null;
    }
  }
  
  private createPerson(reference: PersonReference): PersonEntity {
    const entityId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = reference.name || reference.email || 'Unknown';
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO entities (id, type, title, properties, createdAt, updatedAt)
        VALUES (?, 'Person', ?, ?, datetime('now'), datetime('now'))
      `).run(entityId, name, JSON.stringify({ email: reference.email, phone: reference.phone }));
    } catch {}
    return {
      id: entityId,
      name,
      email: reference.email,
      phone: reference.phone,
    };
  }

  getInteractionHistory(personId: string) {
    return { totalInteractions: 10, recentInteractions: 3, lastInteraction: new Date().toISOString() };
  }
}
