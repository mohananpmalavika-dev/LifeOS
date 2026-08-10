import { Embedding, VectorRecord } from "./types.js";
import { openDatabase, persistDatabase } from "./persistence.js";

function hashString(text: string): number {
  return Array.from(text).reduce((hash, char) => hash + (char.codePointAt(0) ?? 0), 0);
}

export function createEmbedding(text: string): Embedding {
  const seed = hashString(text);
  const values = new Array(16).fill(0).map((_, index) => {
    return ((seed + index * 37) % 100) / 100;
  });
  return { values };
}

type DB = any;

export class VectorStore {
  private records = new Map<string, VectorRecord>();
  private db: DB | null = null;

  constructor() {
    void this.initialize();
  }

  private async initialize() {
    try {
      this.db = await openDatabase();
      const rows = this.db.exec("SELECT id, content, embedding, metadata, insertedAt FROM vectors;");
      if (rows && rows.length) {
        const values = rows[0].values;
        const columns = rows[0].columns;
        for (const row of values) {
          const obj: any = {};
          for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i];
          try {
            const rec: VectorRecord = {
              id: obj.id,
              content: obj.content,
              embedding: JSON.parse(obj.embedding || '[]'),
              metadata: JSON.parse(obj.metadata || '{}'),
              insertedAt: obj.insertedAt,
            };
            this.records.set(rec.id, rec);
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      this.db = null;
    }
  }

  insert(record: VectorRecord): void {
    this.records.set(record.id, record);
    if (this.db) {
      try {
        this.db.run(
          "INSERT OR REPLACE INTO vectors (id, content, embedding, metadata, insertedAt) VALUES (?, ?, ?, ?, ?);",
          [record.id, record.content, JSON.stringify(record.embedding), JSON.stringify(record.metadata || {}), record.insertedAt],
        );
        persistDatabase(this.db);
      } catch (e) {
        // ignore persistence errors
      }
    }
  }

  search(query: string, topK = 3): VectorRecord[] {
    const normalizedQuery = query.toLowerCase();
    const scored = Array.from(this.records.values()).map((record) => {
      const content = String(record.content).toLowerCase();
      const score = normalizedQuery
        .split(" ")
        .filter((term) => term && content.includes(term)).length;
      return { record, score };
    });

    return scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((entry) => entry.record);
  }

  getAllRecords(): VectorRecord[] {
    return Array.from(this.records.values());
  }
}
