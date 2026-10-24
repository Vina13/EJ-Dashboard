import { randomBytes } from "node:crypto";
import { createApp } from "./app";
import { DEFAULT_DB_PATH, openDatabase } from "./db";
import { SEED_ADMIN, seedAdmin } from "./seed";
import { createUserRepo } from "./users";

const port = Number(process.env.EJ_API_PORT ?? 3100);
const dbPath = process.env.EJ_DB_PATH ?? DEFAULT_DB_PATH;

let authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  if (process.env.NODE_ENV === "production") {
    console.error("AUTH_SECRET is not set. Copy .env.example to .env and set it.");
    process.exit(1);
  }
  // Local development only: sessions end whenever the API restarts
  authSecret = randomBytes(32).toString("hex");
  console.warn("AUTH_SECRET is not set; using a random secret for this run.");
}

const db = openDatabase(dbPath);
if (seedAdmin(createUserRepo(db))) {
  console.log(`Seeded admin user ${SEED_ADMIN.email} (password: see apps/ej-api/src/seed.ts)`);
}

createApp({ authSecret, db }).listen(port, () => {
  console.log(`EJ Dashboard API listening on http://localhost:${port} (database: ${dbPath})`);
});
