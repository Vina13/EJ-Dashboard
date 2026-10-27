import type { MachineStatus, MachineType } from "./ejSample";

// Types, validation and the EJ text parser for the EJ menus (ATM List, EJ Preview, Daily Report,
// Merge EJ, EJ Parsing, Upload EJ). The API serves these from the EJ files it stores.

export interface Machine {
  terminalId: string;
  location: string;
  type: MachineType;
  status: MachineStatus;
  /** "YYYY-MM-DD HH:MM" of the last EJ record, or null when no EJ file has arrived yet. */
  lastEjAt: string | null;
}

/** GET /api/machines/:terminalId/ej — the EJ text of one machine for one day. */
export interface EjPreview {
  terminalId: string;
  date: string;
  text: string;
}

/** One transaction found in an EJ file. */
export interface EjTransaction {
  date: string;
  time: string;
  terminalId: string;
  transaction: string;
  /** Rupiah, or null for transactions without an amount (e.g. Cek Saldo). */
  amount: number | null;
  /** Response code; "00" means the transaction succeeded. */
  rc: string;
}

/** GET /api/ej/transactions — parsed transactions for one day. */
export interface EjTransactionList {
  /** Null when no EJ file has been stored yet. */
  date: string | null;
  availableDates: string[];
  rows: EjTransaction[];
}

export interface MachinePerformance {
  terminalId: string;
  location: string;
  transactions: number;
  failed: number;
}

/** GET /api/reports/daily — Daily Report & Performance for one day. */
export interface DailyReport {
  /** Null when no EJ file has been stored yet. */
  date: string | null;
  availableDates: string[];
  machines: { total: number; online: number; problem: number; offline: number };
  rows: MachinePerformance[];
}

/** Body of POST /api/ej/merge. */
export interface MergeEjRequest {
  terminalId: string;
  from: string;
  to: string;
}

/** Result of POST /api/ej/upload. */
export interface UploadEjResult {
  terminalId: string;
  date: string;
  fileName: string;
  size: number;
  transactions: number;
}

export const SUCCESS_RC = "00";
export const MAX_MERGE_DAYS = 31;
export const EJ_FILE_EXTENSIONS = [".txt", ".jrn", ".log"] as const;
export const MAX_EJ_FILE_BYTES = 5 * 1024 * 1024;

// Terminal IDs and file names become folder and file names on the server, so both are whitelisted
const TERMINAL_ID_PATTERN = /^[A-Z0-9]{3,16}$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isTerminalId(value: unknown): value is string {
  return typeof value === "string" && TERMINAL_ID_PATTERN.test(value);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Every date from `from` to `to`, both included. */
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

/** Returns an error message, or null when the input is a valid MergeEjRequest. */
export function validateMergeInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return "Request tidak valid";
  const { terminalId, from, to } = input as Record<string, unknown>;
  if (!isTerminalId(terminalId)) return "Terminal tidak valid";
  if (!isIsoDate(from)) return "Tanggal awal tidak valid";
  if (!isIsoDate(to)) return "Tanggal akhir tidak valid";
  if (from > to) return "Tanggal awal harus sebelum atau sama dengan tanggal akhir";
  if (dateRange(from, to).length > MAX_MERGE_DAYS) return `Rentang tanggal maksimal ${MAX_MERGE_DAYS} hari`;
  return null;
}

/** Returns an error message, or null when the name is safe to store and has an EJ extension. */
export function validateEjFileName(name: unknown): string | null {
  if (typeof name !== "string" || !FILE_NAME_PATTERN.test(name)) {
    return "Nama file hanya boleh berisi huruf, angka, titik, - dan _";
  }
  const lower = name.toLowerCase();
  if (!EJ_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return `File harus berformat ${EJ_FILE_EXTENSIONS.join(" / ")}`;
  }
  return null;
}

const TIME = String.raw`(\d{2}:\d{2}:\d{2})`;
const START = new RegExp(`^${TIME}\\s+TRANSACTION:\\s*(.+?)\\s*$`);
const AMOUNT = /^\d{2}:\d{2}:\d{2}\s+AMOUNT\s*:\s*([\d.]+)\s*$/;
const END = /^\d{2}:\d{2}:\d{2}\s+TRANSACTION END\s+RC=(\w+)\s*$/;
const RECORD = new RegExp(`^${TIME}\\s`);

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * Turns EJ text into transactions. Pattern (sample format until the vendor files arrive, see PRD open
 * questions): "HH:MM:SS TRANSACTION: <type>", optional "HH:MM:SS AMOUNT : 500.000", then
 * "HH:MM:SS TRANSACTION END RC=<code>". A transaction without an END line is left out.
 */
export function parseEj(text: string, terminalId: string, date: string): EjTransaction[] {
  const rows: EjTransaction[] = [];
  let open: EjTransaction | null = null;
  for (const line of text.split(/\r?\n/)) {
    const start = START.exec(line);
    if (start) {
      open = { date, time: start[1], terminalId, transaction: titleCase(start[2]), amount: null, rc: "" };
      continue;
    }
    if (!open) continue;
    const amount = AMOUNT.exec(line);
    if (amount) {
      open.amount = Number(amount[1].replaceAll(".", ""));
      continue;
    }
    const end = END.exec(line);
    if (end) {
      rows.push({ ...open, rc: end[1] });
      open = null;
    }
  }
  return rows;
}

/** "HH:MM" of the last timestamped line, or null when there is none. */
export function lastRecordTime(text: string): string | null {
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = RECORD.exec(lines[i]);
    if (match) return match[1].slice(0, 5);
  }
  return null;
}
