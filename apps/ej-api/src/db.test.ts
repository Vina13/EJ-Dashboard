import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db";

describe("openDatabase", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ej-db-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("[REQ-USER-003] renames the old operator role to monitoring in an existing database", () => {
    const path = join(dir, "old.db");
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'operator')), password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users VALUES (1, 'Admin', 'admin@x.id', 'admin', 'h', 't', 't');
      INSERT INTO users VALUES (2, 'Vina', 'vina@x.id', 'operator', 'h', 't', 't');
    `);
    old.close();

    const db = openDatabase(path);

    expect(db.prepare("SELECT id, role FROM users ORDER BY id").all()).toEqual([
      { id: 1, role: "admin" },
      { id: 2, role: "monitoring" },
    ]);
    expect(() => db.prepare("UPDATE users SET role = 'operator' WHERE id = 1").run()).toThrow();
    db.prepare("INSERT INTO users (name, email, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      "Budi",
      "budi@x.id",
      "monitoring",
      "h",
      "t",
      "t",
    );
    db.close();
  });

  it("[REQ-USER-002] allows the vendor role in a database created before it existed", () => {
    const path = join(dir, "v1.db");
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'monitoring')), password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users VALUES (1, 'Admin', 'admin@x.id', 'admin', 'h', 't', 't');
      INSERT INTO users VALUES (2, 'Vina', 'vina@x.id', 'monitoring', 'h', 't', 't');
    `);
    old.close();

    const db = openDatabase(path);

    expect(db.prepare("SELECT id, role FROM users ORDER BY id").all()).toEqual([
      { id: 1, role: "admin" },
      { id: 2, role: "monitoring" },
    ]);
    const result = db
      .prepare("INSERT INTO users (name, email, role, password_hash, created_at, updated_at) VALUES ('V', 'v@x.id', 'vendor', 'h', 't', 't')")
      .run();
    expect(Number(result.lastInsertRowid)).toBe(3);
    expect(() => db.prepare("UPDATE users SET role = 'root' WHERE id = 1").run()).toThrow();
    db.close();
  });

  it("[REQ-USER-004] never reuses the id of a deleted user after the migration", () => {
    const path = join(dir, "old.db");
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'operator')), password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users (name, email, role, password_hash, created_at, updated_at) VALUES
        ('A', 'a@x.id', 'admin', 'h', 't', 't'),
        ('B', 'b@x.id', 'operator', 'h', 't', 't'),
        ('C', 'c@x.id', 'operator', 'h', 't', 't');
      DELETE FROM users WHERE id = 3;
    `);
    old.close();

    const db = openDatabase(path);
    const result = db
      .prepare("INSERT INTO users (name, email, role, password_hash, created_at, updated_at) VALUES ('D', 'd@x.id', 'monitoring', 'h', 't', 't')")
      .run();
    expect(Number(result.lastInsertRowid)).toBe(4);
    db.close();
  });
});
