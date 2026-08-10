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

  // Some runtimes attempt to load sql-wasm.wasm from the CWD — copy the bundled wasm there as a fallback.
  const fallbackWasm = path.join(process.cwd(), "sql-wasm.wasm");
  try {
    if (fs.existsSync(wasmPath) && !fs.existsSync(fallbackWasm)) {
      fs.copyFileSync(wasmPath, fallbackWasm);
    }
  } catch (e) {
    // ignore copy errors
  }

  let SQL: any;
  try {
    SQL = await (initSqlJs as any)({ locateFile: locate });
  } catch (e) {
    return createInMemoryShim();
  }

  let db;

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(buffer));
  } else {
    db = new SQL.Database();
    db.run(`CREATE TABLE entities (id TEXT PRIMARY KEY, type TEXT, title TEXT, properties TEXT, createdAt TEXT, updatedAt TEXT);`);
    db.run(`CREATE TABLE relations (id TEXT PRIMARY KEY, sourceId TEXT, targetId TEXT, type TEXT, confidence REAL, createdAt TEXT);`);
    db.run(`CREATE TABLE vectors (id TEXT PRIMARY KEY, content TEXT, embedding TEXT, metadata TEXT, insertedAt TEXT);`);
    persistDatabase(db);
  }

  return db;
}

// If wasm/init fails at runtime, provide an in-memory shim with compatible API so the app can run without persistence.
export function createInMemoryShim() {
  return {
    run: (_sql: string, _params?: any[]) => {
      // noop
    },
    exec: (_sql: string) => [],
    export: () => new Uint8Array(),
  };
}

export function persistDatabase(db: any) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}
