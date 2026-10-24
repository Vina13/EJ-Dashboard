import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEjServer } from "./server";

// Same database ej-api uses (apps/ej-api/data/ej-dashboard.db), opened read-only
const dbPath = process.env.EJ_DB_PATH ?? fileURLToPath(new URL("../../ej-api/data/ej-dashboard.db", import.meta.url));
// Opened on first use, so a database that ej-api creates after this server started is still found
let db: DatabaseSync | null = null;
function openDb(): DatabaseSync | null {
  if (!db && existsSync(dbPath)) db = new DatabaseSync(dbPath, { readOnly: true });
  return db;
}

// stdout carries the MCP protocol, so diagnostics go to stderr
if (!openDb()) console.error(`EJ database not found at ${dbPath}; list_users will work once ej-api creates it.`);

await createEjServer({ db: openDb }).connect(new StdioServerTransport());
