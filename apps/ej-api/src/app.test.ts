import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "./app";
import { createEjStore } from "./ejStore";
import { hashPassword } from "./auth/password";
import { LOGIN_MAX_FAILURES } from "./auth/rateLimit";
import { TOKEN_TTL_MS } from "./auth/token";
import { openDatabase } from "./db";
import { SEED_ADMIN, seedAdmin } from "./seed";
import { createUserRepo } from "./users";

// Test names start with the PRD requirement ID (docs/ej-dashboard/testing-strategy.md)

const SECRET = "test-secret";
const MONITORING_PASSWORD = "monitoring123";

/** Fresh in-memory database with the seeded admin and one monitoring user; the clock can be moved. */
function setup() {
  const db = openDatabase(":memory:");
  const users = createUserRepo(db);
  seedAdmin(users);
  const monitoring = users.create({
    name: "Monitoring",
    email: "monitoring@example.com",
    role: "monitoring",
    passwordHash: hashPassword(MONITORING_PASSWORD),
  });
  const clock = { now: Date.UTC(2026, 9, 24) };
  // User tests never touch EJ files; the folder doesn't need to exist
  const ejStore = createEjStore(join(tmpdir(), "ej-api-test-unused"));
  return { app: createApp({ authSecret: SECRET, db, ejStore, now: () => clock.now }), users, monitoring, clock };
}

async function loginAs(app: ReturnType<typeof setup>["app"], email: string, password: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}

const asAdmin = (app: ReturnType<typeof setup>["app"]) => loginAs(app, SEED_ADMIN.email, SEED_ADMIN.password);

const NEW_USER = { name: "Vina", email: "Vina@Example.com", role: "monitoring", password: "rahasia123" };

describe("seedAdmin", () => {
  it("[REQ-AUTH-001] creates the admin only when the table is empty", () => {
    const users = createUserRepo(openDatabase(":memory:"));
    expect(seedAdmin(users)).toBe(true);
    expect(seedAdmin(users)).toBe(false);
    expect(users.count()).toBe(1);
    expect(users.findByEmail(SEED_ADMIN.email)?.role).toBe("admin");
  });
});

describe("auth", () => {
  it("[REQ-AUTH-001] logs in the seeded admin and returns the user without its hash", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: SEED_ADMIN.email, role: "admin" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(String(res.headers["set-cookie"])).toContain("ej_session=");
  });

  it("[REQ-AUTH-002] returns 401 on a wrong password (the flowchart's 'Tidak' branch)", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_ADMIN.email, password: "salah-password" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Email atau password salah" });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("[REQ-AUTH-002] gives the same answer for an unknown email", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "tidak-ada@example.com", password: SEED_ADMIN.password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Email atau password salah" });
  });

  it(`[REQ-AUTH-003] blocks login after ${LOGIN_MAX_FAILURES} failures, even with the right password`, async () => {
    const { app } = setup();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      await request(app).post("/api/auth/login").send({ email: SEED_ADMIN.email, password: "salah" }).expect(401);
    }
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_ADMIN.email, password: SEED_ADMIN.password });
    expect(res.status).toBe(429);
  });

  it("[REQ-AUTH-004][REQ-AUTH-005] GET /api/auth/me needs a session, and logout ends it", async () => {
    const { app } = setup();
    await request(app).get("/api/auth/me").expect(401);

    const agent = await asAdmin(app);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("[REQ-AUTH-004] ends the session after 10 idle minutes", async () => {
    const { app, clock } = setup();
    expect(TOKEN_TTL_MS).toBe(10 * 60 * 1000);
    const agent = await asAdmin(app);
    await agent.get("/api/auth/me").expect(200);

    clock.now += TOKEN_TTL_MS;
    await agent.get("/api/auth/me").expect(401);
  });

  it("[REQ-AUTH-004] keeps the session alive while requests keep coming", async () => {
    const { app, clock } = setup();
    const agent = await asAdmin(app);

    // Three requests 9 minutes apart: 27 minutes in total, never 10 minutes idle
    for (let i = 0; i < 3; i++) {
      clock.now += 9 * 60 * 1000;
      await agent.get("/api/auth/me").expect(200);
    }
    clock.now += TOKEN_TTL_MS;
    await agent.get("/api/auth/me").expect(401);
  });
});

describe("user management", () => {
  it("[REQ-AUTH-005] requires login to list users", async () => {
    const { app } = setup();
    await request(app).get("/api/users").expect(401);
  });

  it("[REQ-USER-001][REQ-USER-002] creates a user that can then log in", async () => {
    const { app } = setup();
    const agent = await asAdmin(app);

    const res = await agent.post("/api/users").send(NEW_USER);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Vina", email: "vina@example.com", role: "monitoring" });

    const list = await agent.get("/api/users");
    expect(list.body.data.map((u: { email: string }) => u.email)).toContain("vina@example.com");
    expect(JSON.stringify(list.body)).not.toContain("passwordHash");

    await loginAs(app, "vina@example.com", NEW_USER.password);
  });

  it("[REQ-USER-002] rejects invalid input and duplicate emails", async () => {
    const { app } = setup();
    const agent = await asAdmin(app);

    const invalid = await agent.post("/api/users").send({ ...NEW_USER, password: "short" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("Password minimal 8 karakter");

    const duplicate = await agent.post("/api/users").send({ ...NEW_USER, email: "monitoring@example.com" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("Email sudah terdaftar");
  });

  it("[REQ-USER-003] edits a user and keeps the password when none is given", async () => {
    const { app, monitoring } = setup();
    const agent = await asAdmin(app);

    const res = await agent
      .put(`/api/users/${monitoring.id}`)
      .send({ name: "Monitoring Satu", email: monitoring.email, role: "monitoring", password: "" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Monitoring Satu");

    await loginAs(app, monitoring.email, MONITORING_PASSWORD);
  });

  it("[REQ-USER-003] changes the password when a new one is given", async () => {
    const { app, monitoring } = setup();
    const agent = await asAdmin(app);

    await agent
      .put(`/api/users/${monitoring.id}`)
      .send({ name: monitoring.name, email: monitoring.email, role: "monitoring", password: "baru12345" })
      .expect(200);

    await request(app).post("/api/auth/login").send({ email: monitoring.email, password: MONITORING_PASSWORD }).expect(401);
    await loginAs(app, monitoring.email, "baru12345");
  });

  it("[REQ-AUTH-004][REQ-USER-003] a password change ends that user's existing sessions", async () => {
    const { app, monitoring } = setup();
    const oldSession = await loginAs(app, monitoring.email, MONITORING_PASSWORD);
    await oldSession.get("/api/auth/me").expect(200);

    const admin = await asAdmin(app);
    await admin
      .put(`/api/users/${monitoring.id}`)
      .send({ name: monitoring.name, email: monitoring.email, role: "monitoring", password: "baru12345" })
      .expect(200);

    await oldSession.get("/api/auth/me").expect(401);
    // Editing other fields keeps the admin's own session
    await admin.get("/api/auth/me").expect(200);
  });

  it("[REQ-USER-003] does not let an admin demote their own account", async () => {
    const { app } = setup();
    const agent = await asAdmin(app);
    const me = (await agent.get("/api/auth/me")).body.data;

    const res = await agent
      .put(`/api/users/${me.id}`)
      .send({ name: me.name, email: me.email, role: "monitoring", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Tidak bisa menurunkan role akun sendiri");
  });

  it("[REQ-USER-003][REQ-USER-004] returns 404 when editing or deleting an unknown user", async () => {
    const { app } = setup();
    const agent = await asAdmin(app);
    await agent.put("/api/users/999").send({ ...NEW_USER }).expect(404);
    await agent.delete("/api/users/999").expect(404);
  });

  it("[REQ-USER-004] deletes a user, but not the account that is logged in", async () => {
    const { app, monitoring } = setup();
    const agent = await asAdmin(app);
    const me = (await agent.get("/api/auth/me")).body.data;

    await agent.delete(`/api/users/${monitoring.id}`).expect(204);
    await agent.get(`/api/users/${monitoring.id}`).expect(404);

    const self = await agent.delete(`/api/users/${me.id}`);
    expect(self.status).toBe(400);
    expect(self.body.error).toBe("Tidak bisa menghapus akun sendiri");
  });

  it.each(["monitoring", "vendor"] as const)(
    "[REQ-USER-001][REQ-USER-005] answers 403 to %s users on every /api/users endpoint",
    async (role) => {
      const { app, users } = setup();
      const user = users.create({
        name: role,
        email: `${role}-only@example.com`,
        role,
        passwordHash: hashPassword(MONITORING_PASSWORD),
      });
      const agent = await loginAs(app, user.email, MONITORING_PASSWORD);

      const list = await agent.get("/api/users");
      expect(list.status).toBe(403);
      expect(list.body.error).toBe("Hanya admin yang boleh mengelola user");
      await agent.get("/api/users/1").expect(403);
      await agent.post("/api/users").send(NEW_USER).expect(403);
      await agent.put(`/api/users/${user.id}`).send({ ...NEW_USER }).expect(403);
      await agent.delete("/api/users/1").expect(403);
    },
  );

  it("[REQ-USER-002] creates a vendor user that can then log in", async () => {
    const { app } = setup();
    const agent = await asAdmin(app);
    const vendor = { ...NEW_USER, email: "vendor@example.com", role: "vendor" };

    const res = await agent.post("/api/users").send(vendor).expect(201);
    expect(res.body.data.role).toBe("vendor");
    await loginAs(app, vendor.email, vendor.password);
  });
});
