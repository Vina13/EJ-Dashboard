import { pathToFileURL } from "node:url";
import { hashPassword } from "./auth/password";
import { DEFAULT_DB_PATH, openDatabase } from "./db";
import { createMachineRepo } from "./machines";
import { seedMachines } from "./sampleEj";
import { createUserRepo, type UserRepo } from "./users";

/**
 * Test admin for local development. Override with EJ_SEED_ADMIN_EMAIL / EJ_SEED_ADMIN_PASSWORD
 * in .env; change the password from User Management before using the app with real data.
 */
export const SEED_ADMIN = {
  name: "Administrator",
  email: process.env.EJ_SEED_ADMIN_EMAIL ?? "admin@ejdashboard.local",
  password: process.env.EJ_SEED_ADMIN_PASSWORD ?? "Admin12345",
};

/** Creates the admin user when the users table is empty. Returns true when it created one. */
export function seedAdmin(users: UserRepo): boolean {
  if (users.count() > 0) return false;
  users.create({
    name: SEED_ADMIN.name,
    email: SEED_ADMIN.email,
    role: "admin",
    passwordHash: hashPassword(SEED_ADMIN.password),
  });
  return true;
}

// `npm run db:seed -w @repo/ej-api`: create the database file, the admin user and the sample machines
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const path = process.env.EJ_DB_PATH ?? DEFAULT_DB_PATH;
  const db = openDatabase(path);
  const created = seedAdmin(createUserRepo(db));
  console.log(created ? `Seeded admin user ${SEED_ADMIN.email} in ${path}` : `Users already exist in ${path}; nothing seeded`);
  // Sample machines are development data; production machines come from the client's master list
  if (process.env.NODE_ENV !== "production" && seedMachines(createMachineRepo(db))) {
    console.log(`Seeded sample machines in ${path}`);
  }
}
