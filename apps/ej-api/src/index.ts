import { randomBytes } from "node:crypto";
import { createApp } from "./app";
import { DEFAULT_DB_PATH, openDatabase } from "./db";
import { DEFAULT_EJ_DIR, createEjStore } from "./ejStore";
import { createMachineRepo } from "./machines";
import { seedMachines, seedSampleEj } from "./sampleEj";
import { SEED_ADMIN, seedAdmin } from "./seed";
import { createUserRepo } from "./users";

const port = Number(process.env.EJ_API_PORT ?? 3100);
const dbPath = process.env.EJ_DB_PATH ?? DEFAULT_DB_PATH;
const ejDir = process.env.EJ_DATA_DIR ?? DEFAULT_EJ_DIR;
const production = process.env.NODE_ENV === "production";

let authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  if (production) {
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

const ejStore = createEjStore(ejDir);
// Until SFTP ingest and the client's machine list exist, development runs on sample machines and EJ files
if (!production) {
  const machines = createMachineRepo(db);
  if (seedMachines(machines)) console.log("Seeded sample machines");
  if (seedSampleEj(ejStore, machines)) console.log(`Wrote sample EJ files to ${ejDir}`);
}

createApp({ authSecret, db, ejStore }).listen(port, () => {
  console.log(`EJ Dashboard API listening on http://localhost:${port} (database: ${dbPath}, EJ files: ${ejDir})`);
});
