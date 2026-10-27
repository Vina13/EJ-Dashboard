import type { DatabaseSync } from "node:sqlite";
import type { EjRole, EjUser } from "@repo/shared";

export interface StoredUser extends EjUser {
  passwordHash: string;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: EjRole;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface NewUser {
  name: string;
  email: string;
  role: EjRole;
  passwordHash: string;
}

export interface UserChanges {
  name: string;
  email: string;
  role: EjRole;
  /** Left out to keep the current password. */
  passwordHash?: string;
}

function fromRow(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicUser({ passwordHash: _, ...user }: StoredUser): EjUser {
  return user;
}

export type UserRepo = ReturnType<typeof createUserRepo>;

/** All reads and writes of the users table. */
export function createUserRepo(db: DatabaseSync, now: () => number = Date.now) {
  const timestamp = () => new Date(now()).toISOString();

  function findById(id: number): StoredUser | undefined {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row && fromRow(row);
  }

  return {
    findById,

    findByEmail(email: string): StoredUser | undefined {
      const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
      return row && fromRow(row);
    },

    list(): StoredUser[] {
      return (db.prepare("SELECT * FROM users ORDER BY id").all() as unknown as UserRow[]).map(fromRow);
    },

    count(): number {
      return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
    },

    create(user: NewUser): StoredUser {
      const at = timestamp();
      const result = db
        .prepare(
          `INSERT INTO users (name, email, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(user.name, user.email, user.role, user.passwordHash, at, at);
      return findById(Number(result.lastInsertRowid))!;
    },

    update(id: number, changes: UserChanges): StoredUser | undefined {
      const current = findById(id);
      if (!current) return undefined;
      db.prepare(
        `UPDATE users SET name = ?, email = ?, role = ?, password_hash = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        changes.name,
        changes.email,
        changes.role,
        changes.passwordHash ?? current.passwordHash,
        timestamp(),
        id,
      );
      return findById(id);
    },

    remove(id: number): boolean {
      return Number(db.prepare("DELETE FROM users WHERE id = ?").run(id).changes) > 0;
    },
  };
}
