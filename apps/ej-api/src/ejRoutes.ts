import express, { Router, type RequestHandler, type Response } from "express";
import {
  MAX_EJ_FILE_BYTES,
  SUCCESS_RC,
  dateRange,
  failure,
  isIsoDate,
  isTerminalId,
  lastRecordTime,
  parseEj,
  success,
  validateEjFileName,
  validateMergeInput,
  type DailyReport,
  type EjPreview,
  type EjTransactionList,
  type Machine,
  type MergeEjRequest,
  type UploadEjResult,
} from "@repo/shared";
import { adminOnly } from "./auth/requireAuth";
import { EjFileExistsError, type EjStore } from "./ejStore";
import type { MachineRepo, StoredMachine } from "./machines";

export interface EjRouterOptions {
  machines: MachineRepo;
  store: EjStore;
  /** requireAuth for this app; every EJ route needs a login. Applied per route so unknown /api paths still 404. */
  auth: RequestHandler;
}

const NOT_FOUND = "Mesin tidak ditemukan";

/**
 * Optional ?date=YYYY-MM-DD. Without it the latest day that has EJ files is used (null when there is none).
 * Sends 400 and returns undefined when the date is malformed.
 */
function pickDate(raw: unknown, available: string[], res: Response): string | null | undefined {
  if (raw === undefined || raw === "") return available.at(-1) ?? null;
  if (!isIsoDate(raw)) {
    res.status(400).json(failure("Tanggal tidak valid"));
    return undefined;
  }
  return raw;
}

/** ATM List, EJ Preview, Daily Report, EJ Parsing, Merge EJ and Upload EJ, all read from the EJ store. */
export function createEjRouter({ machines, store, auth }: EjRouterOptions): Router {
  const router = Router();

  const dayText = (terminalId: string, date: string) =>
    store
      .read(terminalId, date)
      .map((f) => f.content)
      .join("\n");

  function toMachine(machine: StoredMachine): Machine {
    const last = store.dates(machine.terminalId).at(-1);
    const time = last ? lastRecordTime(dayText(machine.terminalId, last)) : null;
    return { ...machine, lastEjAt: last ? (time ? `${last} ${time}` : last) : null };
  }

  function findMachine(raw: unknown, res: Response): StoredMachine | undefined {
    const machine = isTerminalId(raw) ? machines.find(raw) : undefined;
    if (!machine) res.status(404).json(failure(NOT_FOUND));
    return machine;
  }

  // --- Home: ATM List and EJ Preview (REQ-HOME-001, REQ-HOME-002) ---

  router.get("/machines", auth, (_req, res) => {
    res.json(success(machines.list().map(toMachine)));
  });

  router.get("/machines/:terminalId/ej", auth, (req, res) => {
    const machine = findMachine(req.params.terminalId, res);
    if (!machine) return;
    const date = pickDate(req.query.date, store.dates(machine.terminalId), res);
    if (date === undefined) return;
    const text = date ? dayText(machine.terminalId, date) : "";
    if (!date || !text) {
      res.status(404).json(failure(date ? `Tidak ada file EJ ${machine.terminalId} pada tanggal ${date}` : `Belum ada file EJ untuk ${machine.terminalId}`));
      return;
    }
    const body: EjPreview = { terminalId: machine.terminalId, date, text };
    res.json(success(body));
  });

  // --- Daily Report & Performance (REQ-RPT-001, REQ-RPT-002) ---

  router.get("/reports/daily", auth, (req, res) => {
    const availableDates = store.allDates();
    const date = pickDate(req.query.date, availableDates, res);
    if (date === undefined) return;
    const all = machines.list();
    const count = (status: string) => all.filter((m) => m.status === status).length;
    const rows = all.map((m) => {
      const transactions = date ? parseEj(dayText(m.terminalId, date), m.terminalId, date) : [];
      return {
        terminalId: m.terminalId,
        location: m.location,
        transactions: transactions.length,
        failed: transactions.filter((t) => t.rc !== SUCCESS_RC).length,
      };
    });
    const body: DailyReport = {
      date,
      availableDates,
      machines: { total: all.length, online: count("Online"), problem: count("Problem"), offline: count("Offline") },
      rows,
    };
    res.json(success(body));
  });

  // --- EJ Parsing (REQ-PARSE-001) ---

  router.get("/ej/transactions", auth, (req, res) => {
    const { terminalId } = req.query;
    let only: StoredMachine | undefined;
    if (terminalId !== undefined && terminalId !== "") {
      only = findMachine(terminalId, res);
      if (!only) return;
    }
    const availableDates = only ? store.dates(only.terminalId) : store.allDates();
    const date = pickDate(req.query.date, availableDates, res);
    if (date === undefined) return;
    const rows = date
      ? (only ? [only] : machines.list())
          .flatMap((m) => parseEj(dayText(m.terminalId, date), m.terminalId, date))
          .sort((a, b) => a.time.localeCompare(b.time) || a.terminalId.localeCompare(b.terminalId))
      : [];
    const body: EjTransactionList = { date, availableDates, rows };
    res.json(success(body));
  });

  // --- Merge EJ (REQ-MERGE-001): one terminal, a range of days, one text file to download ---

  router.post("/ej/merge", auth, (req, res) => {
    const error = validateMergeInput(req.body);
    if (error) {
      res.status(400).json(failure(error));
      return;
    }
    const { terminalId, from, to } = req.body as MergeEjRequest;
    const machine = findMachine(terminalId, res);
    if (!machine) return;

    const parts = dateRange(from, to).flatMap((date) =>
      store.read(terminalId, date).map((file) => `===== ${terminalId} ${date} — ${file.name} =====\n${file.content.trimEnd()}\n`),
    );
    if (parts.length === 0) {
      res.status(404).json(failure(`Tidak ada file EJ ${terminalId} pada ${from} s.d. ${to}`));
      return;
    }
    res.type("text/plain; charset=utf-8");
    res.attachment(`EJ_${terminalId}_${from.replaceAll("-", "")}-${to.replaceAll("-", "")}.txt`);
    res.send(parts.join("\n"));
  });

  // --- Upload EJ (REQ-UPLOAD-001): the raw file as the body, details in the query string ---

  router.post(
    "/ej/upload",
    auth,
    adminOnly("Hanya admin yang boleh mengunggah file EJ"),
    express.raw({ type: "application/octet-stream", limit: MAX_EJ_FILE_BYTES }),
    (req, res) => {
      const { terminalId, date, fileName } = req.query;
      const nameError = validateEjFileName(fileName);
      if (nameError) {
        res.status(400).json(failure(nameError));
        return;
      }
      if (!isIsoDate(date)) {
        res.status(400).json(failure("Tanggal tidak valid"));
        return;
      }
      const machine = findMachine(terminalId, res);
      if (!machine) return;
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json(failure("File kosong atau bukan file EJ"));
        return;
      }
      const name = fileName as string;
      try {
        store.save(machine.terminalId, date, name, req.body);
      } catch (err) {
        if (!(err instanceof EjFileExistsError)) throw err;
        res.status(409).json(failure(`File ${name} sudah ada untuk ${machine.terminalId} tanggal ${date}`));
        return;
      }
      const body: UploadEjResult = {
        terminalId: machine.terminalId,
        date,
        fileName: name,
        size: req.body.length,
        transactions: parseEj(req.body.toString("utf8"), machine.terminalId, date).length,
      };
      res.status(201).json(success(body));
    },
  );

  return router;
}
