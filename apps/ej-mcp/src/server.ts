import type { DatabaseSync } from "node:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  EJ_ROLES,
  SAMPLE_ATMS,
  SAMPLE_DAILY_REPORT,
  SAMPLE_REPORT_DATE,
  sampleEjPreview,
  type EjUser,
} from "@repo/shared";

export interface EjServerOptions {
  /**
   * The ej-api database, opened read-only. Null when it hasn't been created yet; a function is
   * asked again on every call, so a database created later is picked up without a restart.
   */
  db: DatabaseSync | null | (() => DatabaseSync | null);
}

// Every tool only reads, so a client may call them without asking for confirmation
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** EJ Dashboard data as MCP tools. Users come from SQLite; machines and reports are sample data for now. */
export function createEjServer({ db: dbOption }: EjServerOptions): McpServer {
  const server = new McpServer({ name: "ej-dashboard", version: "0.0.0" });

  server.registerTool(
    "list_users",
    {
      title: "List users",
      description: "Lists EJ Dashboard user accounts (name, email, role). Password hashes are never returned.",
      inputSchema: { role: z.enum(EJ_ROLES).optional().describe("Only return users with this role") },
      annotations: READ_ONLY,
    },
    ({ role }) => {
      const db = typeof dbOption === "function" ? dbOption() : dbOption;
      if (!db) return error("The EJ database doesn't exist yet. Start ej-api once (npm run dev:ej-api) to create it.");
      // Columns are listed so password_hash can never leak through this tool
      const rows = db
        .prepare(
          `SELECT id, name, email, role, created_at AS createdAt, updated_at AS updatedAt
           FROM users WHERE ? IS NULL OR role = ? ORDER BY id`,
        )
        .all(role ?? null, role ?? null) as unknown as EjUser[];
      return json(rows);
    },
  );

  server.registerTool(
    "list_machines",
    {
      title: "List machines",
      description: "Lists ATM/CRM machines with location, status and the time of their last EJ record.",
      inputSchema: {
        status: z.enum(["Online", "Offline", "Problem"]).optional().describe("Only return machines with this status"),
        type: z.enum(["ATM", "CRM"]).optional().describe("Only return machines of this type"),
      },
      annotations: READ_ONLY,
    },
    ({ status, type }) =>
      json(SAMPLE_ATMS.filter((m) => (!status || m.status === status) && (!type || m.type === type))),
  );

  server.registerTool(
    "get_daily_report",
    {
      title: "Get daily report",
      description:
        "Daily Report & Performance: totals (machines, online, transactions, failed, success rate) and per-machine rows.",
      inputSchema: { terminalId: z.string().optional().describe("Only include this machine, e.g. S1A0101") },
      annotations: READ_ONLY,
    },
    ({ terminalId }) => {
      const rows = SAMPLE_DAILY_REPORT.filter((r) => !terminalId || r.terminalId === terminalId);
      if (rows.length === 0) return error(`No machine with terminal ID ${terminalId}`);
      const transactions = rows.reduce((sum, r) => sum + r.transactions, 0);
      const failed = rows.reduce((sum, r) => sum + r.failed, 0);
      const machines = SAMPLE_ATMS.filter((m) => rows.some((r) => r.terminalId === m.terminalId));
      return json({
        reportDate: SAMPLE_REPORT_DATE,
        summary: {
          machines: machines.length,
          online: machines.filter((m) => m.status === "Online").length,
          transactions,
          failed,
          successRatePercent: transactions === 0 ? null : Math.round(((transactions - failed) / transactions) * 1000) / 10,
        },
        machines: rows,
      });
    },
  );

  server.registerTool(
    "get_ej_preview",
    {
      title: "Get EJ preview",
      description: "Returns the electronic journal (EJ) text excerpt for one machine.",
      inputSchema: { terminalId: z.string().describe("Terminal ID, e.g. S1A0101") },
      annotations: READ_ONLY,
    },
    ({ terminalId }) => {
      const machine = SAMPLE_ATMS.find((m) => m.terminalId === terminalId);
      if (!machine) return error(`No machine with terminal ID ${terminalId}`);
      return { content: [{ type: "text" as const, text: sampleEjPreview(machine) }] };
    },
  );

  return server;
}
