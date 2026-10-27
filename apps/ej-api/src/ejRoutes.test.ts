import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "./app";
import { hashPassword } from "./auth/password";
import { openDatabase } from "./db";
import { createEjStore } from "./ejStore";
import { createMachineRepo } from "./machines";
import { SAMPLE_EJ_DATES, seedMachines, seedSampleEj } from "./sampleEj";
import { SEED_ADMIN, seedAdmin } from "./seed";
import { createUserRepo } from "./users";

// Test names start with the PRD requirement ID (docs/ej-dashboard/testing-strategy.md)

const MONITORING = { email: "monitoring@example.com", password: "monitoring123" };
const LAST_DAY = SAMPLE_EJ_DATES[SAMPLE_EJ_DATES.length - 1];
const dirs: string[] = [];

/** In-memory database with users and sample machines, and a temp folder with the sample EJ files. */
function setup({ sampleEj = true } = {}) {
  const db = openDatabase(":memory:");
  const users = createUserRepo(db);
  seedAdmin(users);
  users.create({ name: "Monitoring", email: MONITORING.email, role: "monitoring", passwordHash: hashPassword(MONITORING.password) });
  const machines = createMachineRepo(db);
  seedMachines(machines);
  const dir = mkdtempSync(join(tmpdir(), "ej-store-"));
  dirs.push(dir);
  const store = createEjStore(dir);
  if (sampleEj) seedSampleEj(store, machines);
  return { app: createApp({ authSecret: "test-secret", db, ejStore: store }), store };
}

async function loginAs(app: ReturnType<typeof setup>["app"], email: string, password: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}
const asAdmin = (app: ReturnType<typeof setup>["app"]) => loginAs(app, SEED_ADMIN.email, SEED_ADMIN.password);

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("EJ routes need a login", () => {
  it.each([
    ["get", "/api/machines"],
    ["get", "/api/machines/S1A0101/ej"],
    ["get", "/api/reports/daily"],
    ["get", "/api/ej/transactions"],
    ["post", "/api/ej/merge"],
    ["post", "/api/ej/upload"],
  ] as const)("[REQ-AUTH-005] %s %s returns 401 without a session", async (method, path) => {
    const { app } = setup({ sampleEj: false });
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });
});

describe("ATM List and EJ Preview", () => {
  it("[REQ-HOME-001] lists machines with the time of their last EJ record", async () => {
    const agent = await asAdmin(setup().app);
    const res = await agent.get("/api/machines").expect(200);

    expect(res.body.data).toHaveLength(5);
    const byId = Object.fromEntries(res.body.data.map((m: { terminalId: string }) => [m.terminalId, m]));
    expect(byId.S1A0101).toMatchObject({ type: "ATM", status: "Online", lastEjAt: expect.stringMatching(/^2026-10-24 (1\d|2\d):\d{2}$/) });
    // Offline machines stopped sending a day earlier, Problem machines mid-morning
    expect(byId.S1A0418.lastEjAt).toMatch(/^2026-10-23 /);
    expect(byId.S1A0215.lastEjAt).toMatch(/^2026-10-24 (0\d|1[01]):/);
  });

  it("[REQ-HOME-001] shows null when a machine has no EJ yet", async () => {
    const agent = await asAdmin(setup({ sampleEj: false }).app);
    const res = await agent.get("/api/machines").expect(200);
    expect(res.body.data[0].lastEjAt).toBeNull();
  });

  it("[REQ-HOME-002] returns the latest EJ of a machine, or of a chosen day", async () => {
    const agent = await asAdmin(setup().app);

    const latest = await agent.get("/api/machines/S1A0101/ej").expect(200);
    expect(latest.body.data).toMatchObject({ terminalId: "S1A0101", date: LAST_DAY });
    expect(latest.body.data.text).toContain("*** ELECTRONIC JOURNAL S1A0101 ***");

    const chosen = await agent.get("/api/machines/S1A0101/ej?date=2026-10-20").expect(200);
    expect(chosen.body.data.text).toContain("TANGGAL  : 2026-10-20");
  });

  it("[REQ-HOME-002] answers 404 for unknown machines and missing days, 400 for bad dates", async () => {
    const agent = await asAdmin(setup().app);
    expect((await agent.get("/api/machines/XX999/ej")).status).toBe(404);
    expect((await agent.get("/api/machines/S1A0101/ej?date=2026-01-01")).body.error).toBe(
      "Tidak ada file EJ S1A0101 pada tanggal 2026-01-01",
    );
    expect((await agent.get("/api/machines/S1A0101/ej?date=kemarin")).status).toBe(400);
  });
});

describe("Daily Report & Performance", () => {
  it("[REQ-RPT-001] counts transactions and failures from the parsed EJ of the latest day", async () => {
    const agent = await asAdmin(setup().app);
    const { data } = (await agent.get("/api/reports/daily").expect(200)).body;

    expect(data.date).toBe(LAST_DAY);
    expect(data.availableDates).toEqual(SAMPLE_EJ_DATES);
    expect(data.machines).toEqual({ total: 5, online: 3, problem: 1, offline: 1 });
    const offline = data.rows.find((r: { terminalId: string }) => r.terminalId === "S1A0418");
    expect(offline).toMatchObject({ transactions: 0, failed: 0 });
    const online = data.rows.find((r: { terminalId: string }) => r.terminalId === "S1A0101");
    expect(online.transactions).toBeGreaterThan(0);
  });

  it("[REQ-RPT-002] shows another day when a date is given", async () => {
    const agent = await asAdmin(setup().app);
    const { data } = (await agent.get("/api/reports/daily?date=2026-10-20").expect(200)).body;
    expect(data.date).toBe("2026-10-20");
    expect(data.rows.find((r: { terminalId: string }) => r.terminalId === "S1A0418").transactions).toBeGreaterThan(0);
  });

  it("[REQ-RPT-001] reports no date when no EJ file exists yet", async () => {
    const agent = await asAdmin(setup({ sampleEj: false }).app);
    const { data } = (await agent.get("/api/reports/daily").expect(200)).body;
    expect(data).toMatchObject({ date: null, availableDates: [] });
  });
});

describe("EJ Parsing", () => {
  it("[REQ-PARSE-001] returns parsed transactions of all machines, sorted by time", async () => {
    const agent = await asAdmin(setup().app);
    const { data } = (await agent.get("/api/ej/transactions").expect(200)).body;

    expect(data.date).toBe(LAST_DAY);
    expect(data.rows.length).toBeGreaterThan(10);
    expect(data.rows[0]).toEqual({
      date: LAST_DAY,
      time: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
      terminalId: expect.any(String),
      transaction: expect.any(String),
      amount: expect.toBeOneOf([null, expect.any(Number)]),
      rc: expect.stringMatching(/^\d{2}$/),
    });
    const times = data.rows.map((r: { time: string }) => r.time);
    expect(times).toEqual([...times].sort());
  });

  it("[REQ-PARSE-001] filters by terminal", async () => {
    const agent = await asAdmin(setup().app);
    const { data } = (await agent.get("/api/ej/transactions?terminalId=S1A0102&date=2026-10-21").expect(200)).body;
    expect(new Set(data.rows.map((r: { terminalId: string }) => r.terminalId))).toEqual(new Set(["S1A0102"]));
    expect((await agent.get("/api/ej/transactions?terminalId=NOPE1")).status).toBe(404);
  });
});

describe("Merge EJ", () => {
  it("[REQ-MERGE-001] joins the EJ files of the range into one download", async () => {
    const agent = await asAdmin(setup().app);
    const res = await agent.post("/api/ej/merge").send({ terminalId: "S1A0101", from: "2026-10-20", to: "2026-10-22" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/plain/);
    expect(res.headers["content-disposition"]).toBe("attachment; filename=EJ_S1A0101_20261020-20261022.txt");
    const headers = res.text.match(/^===== .+ =====$/gm);
    expect(headers).toEqual([
      "===== S1A0101 2026-10-20 — EJ_S1A0101_20261020.jrn =====",
      "===== S1A0101 2026-10-21 — EJ_S1A0101_20261021.jrn =====",
      "===== S1A0101 2026-10-22 — EJ_S1A0101_20261022.jrn =====",
    ]);
  });

  it("[REQ-MERGE-001] rejects invalid input, unknown machines and empty ranges", async () => {
    const agent = await asAdmin(setup().app);
    const merge = (body: object) => agent.post("/api/ej/merge").send(body);

    expect((await merge({ terminalId: "S1A0101", from: "2026-10-24", to: "2026-10-20" })).status).toBe(400);
    expect((await merge({ terminalId: "../../etc", from: "2026-10-20", to: "2026-10-20" })).body.error).toBe("Terminal tidak valid");
    expect((await merge({ terminalId: "ZZ0001", from: "2026-10-20", to: "2026-10-20" })).status).toBe(404);
    const empty = await merge({ terminalId: "S1A0101", from: "2026-01-01", to: "2026-01-05" });
    expect(empty.status).toBe(404);
    expect(empty.body.error).toBe("Tidak ada file EJ S1A0101 pada 2026-01-01 s.d. 2026-01-05");
  });

  it("[REQ-MERGE-001] is open to monitoring users", async () => {
    const agent = await loginAs(setup().app, MONITORING.email, MONITORING.password);
    await agent.post("/api/ej/merge").send({ terminalId: "S1A0101", from: LAST_DAY, to: LAST_DAY }).expect(200);
  });
});

describe("Upload EJ", () => {
  const EJ = "*** ELECTRONIC JOURNAL S1A0101 ***\n09:00:00 TRANSACTION: CEK SALDO\n09:00:05 TRANSACTION END  RC=00\n";
  const upload = (agent: request.Agent, query: string, body = EJ) =>
    agent.post(`/api/ej/upload?${query}`).set("Content-Type", "application/octet-stream").send(Buffer.from(body));

  it("[REQ-UPLOAD-001] stores the file so every EJ menu sees it", async () => {
    const { app } = setup({ sampleEj: false });
    const agent = await asAdmin(app);

    const res = await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=manual.jrn");
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ terminalId: "S1A0101", date: "2026-10-25", fileName: "manual.jrn", size: EJ.length, transactions: 1 });

    const preview = await agent.get("/api/machines/S1A0101/ej").expect(200);
    expect(preview.body.data).toMatchObject({ date: "2026-10-25", text: EJ });
    const parsed = await agent.get("/api/ej/transactions").expect(200);
    expect(parsed.body.data.rows).toHaveLength(1);
  });

  it("[REQ-UPLOAD-001] never overwrites an existing file", async () => {
    const agent = await asAdmin(setup({ sampleEj: false }).app);
    await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=a.txt").expect(201);
    const again = await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=a.txt");
    expect(again.status).toBe(409);
  });

  it("[REQ-UPLOAD-001] rejects unsafe names, other formats, bad dates, unknown machines and empty files", async () => {
    const agent = await asAdmin(setup({ sampleEj: false }).app);
    expect((await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=..%2Fx.txt")).status).toBe(400);
    expect((await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=x.exe")).status).toBe(400);
    expect((await upload(agent, "terminalId=S1A0101&date=25-10-2026&fileName=x.txt")).status).toBe(400);
    expect((await upload(agent, "terminalId=..&date=2026-10-25&fileName=x.txt")).status).toBe(404);
    expect((await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=x.txt", "")).status).toBe(400);
  });

  it("[REQ-UPLOAD-001][REQ-USER-005] is only for admins", async () => {
    const agent = await loginAs(setup({ sampleEj: false }).app, MONITORING.email, MONITORING.password);
    const res = await upload(agent, "terminalId=S1A0101&date=2026-10-25&fileName=x.txt");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Hanya admin yang boleh mengunggah file EJ");
  });
});
