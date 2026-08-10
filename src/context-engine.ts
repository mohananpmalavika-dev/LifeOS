import {
  ContextEntity,
  ContextRelation,
  NormalizedEvent,
  RelationType,
} from "./types.js";
import { openDatabase, persistDatabase } from "./persistence.js";

type DB = any;

function timestamp(): string {
  return new Date().toISOString();
}

export class ContextGraph {
  // lightweight in-memory cache backed by sqlite persistence (optional)
  private entities = new Map<string, ContextEntity>();
  private relations = new Map<string, ContextRelation>();
  private db: DB | null = null;

  constructor() {
    void this.initializePersistence();
  }

  private async initializePersistence() {
    try {
      this.db = await openDatabase();
      // load existing entities
      const rows = this.db.exec("SELECT id, type, title, properties, createdAt, updatedAt FROM entities;");
      if (rows && rows.length) {
        const values = rows[0].values;
        const columns = rows[0].columns;
        for (const row of values) {
          const obj: any = {};
          for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i];
          try {
            const entity: ContextEntity = {
              id: obj.id,
              type: obj.type,
              title: obj.title,
              properties: JSON.parse(obj.properties || "{}"),
              createdAt: obj.createdAt,
              updatedAt: obj.updatedAt,
            };
            this.entities.set(entity.id, entity);
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      const rrows = this.db.exec("SELECT id, sourceId, targetId, type, confidence, createdAt FROM relations;");
      if (rrows && rrows.length) {
        const values = rrows[0].values;
        const columns = rrows[0].columns;
        for (const row of values) {
          const obj: any = {};
          for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i];
          const rel: ContextRelation = {
            id: obj.id,
            sourceId: obj.sourceId,
            targetId: obj.targetId,
            type: obj.type as RelationType,
            confidence: Number(obj.confidence),
            createdAt: obj.createdAt,
          };
          this.relations.set(rel.id, rel);
        }
      }
    } catch (err) {
      // persistence optional
      this.db = null;
    }
  }

  addEntity(entity: ContextEntity): void {
    this.entities.set(entity.id, entity);
    if (this.db) {
      try {
        this.db.run(
          "INSERT OR REPLACE INTO entities (id, type, title, properties, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?);",
          [entity.id, entity.type, entity.title, JSON.stringify(entity.properties || {}), entity.createdAt, entity.updatedAt],
        );
        persistDatabase(this.db);
      } catch (e) {
        // ignore persistence errors
      }
    }
  }

  addRelation(relation: ContextRelation): void {
    this.relations.set(relation.id, relation);
    if (this.db) {
      try {
        this.db.run(
          "INSERT OR REPLACE INTO relations (id, sourceId, targetId, type, confidence, createdAt) VALUES (?, ?, ?, ?, ?, ?);",
          [relation.id, relation.sourceId, relation.targetId, relation.type, relation.confidence, relation.createdAt],
        );
        persistDatabase(this.db);
      } catch (e) {
        // ignore
      }
    }
  }

  findEntityByTitle(title: string): ContextEntity | undefined {
    return Array.from(this.entities.values()).find((entity) =>
      entity.title.toLowerCase() === title.toLowerCase(),
    );
  }

  ingestEvent(event: NormalizedEvent): void {
    const eventEntity = this.createOrUpdateEntity({
      id: `event:${event.id}`,
      type: "Event",
      title: event.event,
      properties: {
        source: event.source,
        metadata: event.metadata,
        confidence: event.confidence,
      },
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    });
    // record raw entity mentions
    for (const term of event.entities) {
      const entity = this.createOrUpdateEntity({
        id: `entity:${term}`,
        type: "Object",
        title: term,
        properties: { inferredFrom: event.id },
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      });

      this.addRelation({
        id: `relation:${event.id}:${term}`,
        sourceId: eventEntity.id,
        targetId: entity.id,
        type: "MENTIONED_IN",
        confidence: event.confidence,
        createdAt: timestamp(),
      });
    }

    // if the event has structured metadata, create typed entities and relations for them
    const structured = (event.metadata && (event.metadata as any).structured) || {};
    if (structured) {
      if (structured.person) {
        const p = this.createOrUpdateEntity({
          id: `person:${String(structured.person).toLowerCase()}`,
          type: "Person",
          title: String(structured.person),
          properties: { inferredFrom: event.id },
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        this.addRelation({ id: `relation:${event.id}:person`, sourceId: eventEntity.id, targetId: p.id, type: "KNOWS", confidence: event.confidence, createdAt: timestamp() });
      }

      if (structured.place) {
        const plc = this.createOrUpdateEntity({
          id: `place:${String(structured.place).toLowerCase()}`,
          type: "Place",
          title: String(structured.place),
          properties: { inferredFrom: event.id },
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        this.addRelation({ id: `relation:${event.id}:place`, sourceId: eventEntity.id, targetId: plc.id, type: "LOCATED_AT", confidence: event.confidence, createdAt: timestamp() });
      }

      if (structured.object) {
        const obj = this.createOrUpdateEntity({
          id: `object:${String(structured.object).toLowerCase().replace(/\s+/g, "_")}`,
          type: "Object",
          title: String(structured.object),
          properties: { inferredFrom: event.id },
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        this.addRelation({ id: `relation:${event.id}:object`, sourceId: eventEntity.id, targetId: obj.id, type: "REQUIRES", confidence: event.confidence, createdAt: timestamp() });
      }

      if (structured.time) {
        const timeId = `time:${new Date(structured.time).toISOString()}`;
        const timeEnt = this.createOrUpdateEntity({
          id: timeId,
          type: "Commitment",
          title: new Date(structured.time).toISOString(),
          properties: { inferredFrom: event.id, iso: structured.time },
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        });
        this.addRelation({ id: `relation:${event.id}:time`, sourceId: eventEntity.id, targetId: timeEnt.id, type: "PLANNED_FOR", confidence: event.confidence, createdAt: timestamp() });
      }
    }
  }

  private createOrUpdateEntity(entity: ContextEntity): ContextEntity {
    const existing = this.entities.get(entity.id);
    if (existing) {
      existing.updatedAt = entity.updatedAt;
      existing.properties = { ...existing.properties, ...entity.properties };
      return existing;
    }

    this.entities.set(entity.id, entity);
    return entity;
  }

  getEntities(): ContextEntity[] {
    return Array.from(this.entities.values());
  }

  getRelations(): ContextRelation[] {
    return Array.from(this.relations.values());
  }

  // Query helpers for relationship-based reasoning
  getRelationsForEntity(entityId: string, relationType?: RelationType): ContextRelation[] {
    return Array.from(this.relations.values()).filter(r => 
      (r.sourceId === entityId || r.targetId === entityId) &&
      (!relationType || r.type === relationType)
    );
  }

  findRelatedEntities(entityId: string, relationType: RelationType, direction: 'outgoing' | 'incoming' | 'both' = 'both'): ContextEntity[] {
    const relations = this.getRelationsForEntity(entityId, relationType);
    const targetIds = new Set<string>();
    
    for (const rel of relations) {
      if (direction === 'outgoing' && rel.sourceId === entityId) {
        targetIds.add(rel.targetId);
      } else if (direction === 'incoming' && rel.targetId === entityId) {
        targetIds.add(rel.sourceId);
      } else if (direction === 'both') {
        targetIds.add(rel.sourceId === entityId ? rel.targetId : rel.sourceId);
      }
    }
    
    return Array.from(targetIds)
      .map(id => this.entities.get(id))
      .filter((e): e is ContextEntity => e !== undefined);
  }
}
