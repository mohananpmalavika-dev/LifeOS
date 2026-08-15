import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "lifeos.db");

export async function openDatabase() {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const locate = (file: any) => {
    if (fs.existsSync(wasmPath)) return wasmPath;
    return file;
  };

  const fallbackWasm = path.join(process.cwd(), "sql-wasm.wasm");
  try {
    if (fs.existsSync(wasmPath) && !fs.existsSync(fallbackWasm)) {
      fs.copyFileSync(wasmPath, fallbackWasm);
    }
  } catch (e) {}

  let SQL: any;
  try {
    SQL = await (initSqlJs as any)({ locateFile: locate });
  } catch (e) {
    console.error("FATAL: Failed to initialize SQLite / SQL.js persistence engine:", e);
    throw new Error("Database initialization failed. Ambient context engine halted to prevent data loss.");
  }

  let db;

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
    db.run(`CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, type TEXT, title TEXT, properties TEXT, createdAt TEXT, updatedAt TEXT);`);
    db.run(`CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY, sourceId TEXT, targetId TEXT, type TEXT, confidence REAL, createdAt TEXT);`);
    db.run(`CREATE TABLE IF NOT EXISTS vectors (id TEXT PRIMARY KEY, content TEXT, embedding TEXT, metadata TEXT, insertedAt TEXT);`);
    persistDatabase(db);
  }

  return db;
}

export function persistDatabase(db: any) {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error("ERROR: Failed to persist database to disk:", e);
  }
}
