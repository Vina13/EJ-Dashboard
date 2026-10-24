import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createEjServer } from "./server";

function seededDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT, password_hash TEXT,
                        created_at TEXT, updated_at TEXT);
    INSERT INTO users VALUES (1, 'Administrator', 'admin@ejdashboard.local', 'admin', 'secret-hash', 't', 't');
    INSERT INTO users VALUES (2, 'Vina', 'vina@example.com', 'monitoring', 'secret-hash', 't', 't');
  `);
  return db;
}

async function connect(db: DatabaseSync | null | (() => DatabaseSync | null)) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([createEjServer({ db }).connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { text: string }[])[0].text;
  return { isError: result.isError === true, text };
}

describe("ej-dashboard MCP server", () => {
  it("[ADR-0006] exposes four read-only tools", async () => {
    const { tools } = await (await connect(null)).listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_daily_report", "get_ej_preview", "list_machines", "list_users"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("[REQ-USER-001] lists users without password hashes and filters by role", async () => {
    const client = await connect(seededDb());
    const all = await call(client, "list_users");
    expect(JSON.parse(all.text)).toHaveLength(2);
    expect(all.text).not.toContain("secret-hash");

    const monitoringUsers = JSON.parse((await call(client, "list_users", { role: "monitoring" })).text);
    expect(monitoringUsers).toEqual([expect.objectContaining({ name: "Vina", role: "monitoring" })]);
  });

  it("[REQ-USER-001] explains how to create the database when it is missing", async () => {
    const result = await call(await connect(null), "list_users");
    expect(result.isError).toBe(true);
    expect(result.text).toContain("npm run dev:ej-api");
  });

  it("[REQ-USER-001] finds a database that is created after the server started", async () => {
    let db: DatabaseSync | null = null;
    const client = await connect(() => db);
    expect((await call(client, "list_users")).isError).toBe(true);

    db = seededDb();
    expect(JSON.parse((await call(client, "list_users")).text)).toHaveLength(2);
  });

  it("[REQ-HOME-001] filters machines by status", async () => {
    const machines = JSON.parse((await call(await connect(null), "list_machines", { status: "Offline" })).text);
    expect(machines.map((m: { terminalId: string }) => m.terminalId)).toEqual(["S1A0418"]);
  });

  it("[REQ-RPT-001] summarises the daily report, overall and per machine", async () => {
    const client = await connect(null);
    const overall = JSON.parse((await call(client, "get_daily_report")).text);
    expect(overall.summary).toEqual({ machines: 5, online: 3, transactions: 1699, failed: 46, successRatePercent: 97.3 });

    const one = JSON.parse((await call(client, "get_daily_report", { terminalId: "S1A0215" })).text);
    expect(one.summary).toMatchObject({ machines: 1, online: 0, transactions: 187, failed: 23 });

    expect((await call(client, "get_daily_report", { terminalId: "NOPE" })).isError).toBe(true);
  });

  it("[REQ-HOME-002] returns the EJ preview for a machine", async () => {
    const client = await connect(null);
    expect((await call(client, "get_ej_preview", { terminalId: "S1A0102" })).text).toContain("ELECTRONIC JOURNAL S1A0102");
    expect((await call(client, "get_ej_preview", { terminalId: "NOPE" })).isError).toBe(true);
  });
});
