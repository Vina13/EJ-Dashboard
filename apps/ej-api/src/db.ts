import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

/** apps/ej-api/data/ej-dashboard.db, wherever the process is started from. */
export const DEFAULT_DB_PATH = fileURLToPath(new URL("../data/ej-dashboard.db", import.meta.url));

/** Opens (or creates) the SQLite database and applies the schema. Pass ":memory:" in tests. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

const USERS_TABLE = (name: string) => `
  CREATE TABLE ${name} (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    role          TEXT    NOT NULL CHECK (role IN ('admin', 'monitoring')),
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
  )
`;

// ATM List; the EJ files themselves live on disk (ejStore.ts)
const MACHINES_TABLE = `
  CREATE TABLE IF NOT EXISTS machines (
    terminal_id TEXT PRIMARY KEY,
    location    TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('ATM', 'CRM')),
    status      TEXT NOT NULL CHECK (status IN ('Online', 'Offline', 'Problem'))
  )
`;

function migrate(db: DatabaseSync): void {
  db.exec(MACHINES_TABLE);
  migrateUsers(db);
}

function migrateUsers(db: DatabaseSync): void {
  const existing = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as
    | { sql: string }
    | undefined;
  if (!existing) {
    db.exec(USERS_TABLE("users"));
    return;
  }
  // The "operator" role was renamed to "monitoring". SQLite can't alter a CHECK constraint,
  // so the table is rebuilt with the new constraint and existing operators become monitoring.
  if (existing.sql.includes("'operator'")) {
    db.exec("BEGIN");
    try {
      db.exec(USERS_TABLE("users_new"));
      db.exec(`
        INSERT INTO users_new (id, name, email, role, password_hash, created_at, updated_at)
        SELECT id, name, email, CASE role WHEN 'operator' THEN 'monitoring' ELSE role END,
               password_hash, created_at, updated_at
        FROM users
      `);
      // Keep the AUTOINCREMENT high-water mark: a reused id would let a deleted user's
      // still-valid session token (it carries the user id) sign in as the new user
      const sequence = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'users'").get() as
        | { seq: number }
        | undefined;
      db.exec("DROP TABLE users");
      db.exec("ALTER TABLE users_new RENAME TO users");
      if (sequence) {
        db.prepare("UPDATE sqlite_sequence SET seq = max(seq, ?) WHERE name = 'users'").run(sequence.seq);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
