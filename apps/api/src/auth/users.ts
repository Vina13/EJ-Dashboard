import type { User } from "@repo/shared";
import { hashPassword } from "./password";

export interface StoredUser extends User {
  passwordHash: string;
}

/** Demo password for the seeded users. There is no database yet. */
export const DEMO_PASSWORD = "password123";

/** Compared against when the email is unknown, so response timing doesn't reveal which emails exist. */
export const DUMMY_HASH = hashPassword("dummy-password");

export const users: StoredUser[] = [
  { id: 1, name: "Ana", email: "ana@example.com", passwordHash: hashPassword(DEMO_PASSWORD) },
  { id: 2, name: "Budi", email: "budi@example.com", passwordHash: hashPassword(DEMO_PASSWORD) },
];

export function findUserByEmail(email: string): StoredUser | undefined {
  return users.find((u) => u.email === email);
}

export function findUserById(id: number): StoredUser | undefined {
  return users.find((u) => u.id === id);
}

export function toPublicUser({ passwordHash: _, ...user }: StoredUser): User {
  return user;
}
