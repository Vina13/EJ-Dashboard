import request from "supertest";
import { createApp } from "./app";
import { LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } from "./auth/rateLimit";
import { TOKEN_TTL_MS, signToken, verifyToken } from "./auth/token";
import { DEMO_PASSWORD } from "./auth/users";

const SECRET = "test-secret";
const NOW = Date.UTC(2026, 0, 1);
const app = createApp({ authSecret: SECRET, now: () => NOW });

const ANA = { id: 1, name: "Ana", email: "ana@example.com" };
const UNAUTHORIZED = { ok: false, error: "Belum login" };

function sessionCookie(res: request.Response): string | undefined {
  const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  return cookies?.find((c) => c.startsWith("session="));
}

/** App with a clock the test can move forward. */
function createAppWithClock() {
  const clock = { now: NOW };
  return { clock, app: createApp({ authSecret: SECRET, now: () => clock.now }) };
}

async function loggedInAgent(target = app) {
  const agent = request.agent(target);
  await agent
    .post("/api/auth/login")
    .send({ email: ANA.email, password: DEMO_PASSWORD })
    .expect(200);
  return agent;
}

describe("POST /api/auth/login", () => {
  it("returns 200 and a session token on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: DEMO_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: ANA });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");

    const token = cookie!.split(";")[0].slice("session=".length);
    expect(verifyToken(token, SECRET, NOW)).toBe(1);
  });

  it("normalizes email case and surrounding whitespace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  Ana@Example.COM ", password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("returns 401 on wrong password without setting a cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Email atau password salah" });
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("returns the same 401 for an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: DEMO_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Email atau password salah" });
  });

  it("returns 400 on an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: DEMO_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "Email tidak valid" });
  });

  it("returns 400 on an empty password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "Password wajib diisi" });
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

describe("login rate limit", () => {
  function attempt(target: Parameters<typeof request>[0], password: string, email = ANA.email) {
    return request(target).post("/api/auth/login").send({ email, password });
  }

  async function failTimes(target: Parameters<typeof request>[0], times: number) {
    for (let i = 0; i < times; i++) {
      await attempt(target, "wrong-password").expect(401);
    }
  }

  it(`returns 429 after ${LOGIN_MAX_FAILURES} failures, even with the right password`, async () => {
    const { app } = createAppWithClock();
    await failTimes(app, LOGIN_MAX_FAILURES);

    const res = await attempt(app, DEMO_PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.ok).toBe(false);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("does not block other emails", async () => {
    const { app } = createAppWithClock();
    await failTimes(app, LOGIN_MAX_FAILURES);

    await attempt(app, DEMO_PASSWORD, "budi@example.com").expect(200);
  });

  it("allows attempts again once the window has passed", async () => {
    const { app, clock } = createAppWithClock();
    await failTimes(app, LOGIN_MAX_FAILURES);

    clock.now += LOGIN_WINDOW_MS;
    await attempt(app, DEMO_PASSWORD).expect(200);
  });

  it("resets the failure count after a successful login", async () => {
    const { app } = createAppWithClock();
    await failTimes(app, LOGIN_MAX_FAILURES - 1);
    await attempt(app, DEMO_PASSWORD).expect(200);

    await failTimes(app, LOGIN_MAX_FAILURES - 1);
    await attempt(app, DEMO_PASSWORD).expect(200);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED);
  });

  it("returns the current user after login", async () => {
    const agent = await loggedInAgent();
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: ANA });
  });

  it("returns 401 for a tampered token", async () => {
    const token = signToken(1, SECRET, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    const res = await request(app).get("/api/auth/me").set("Cookie", `session=${tampered}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token signed with another secret", async () => {
    const token = signToken(1, "other-secret", NOW);
    const res = await request(app).get("/api/auth/me").set("Cookie", `session=${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a token of a user that no longer exists", async () => {
    const token = signToken(999, SECRET, NOW);
    const res = await request(app).get("/api/auth/me").set("Cookie", `session=${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 once the token has expired", async () => {
    const { app, clock } = createAppWithClock();
    const agent = await loggedInAgent(app);
    await agent.get("/api/auth/me").expect(200);

    clock.now += TOKEN_TTL_MS;
    await agent.get("/api/auth/me").expect(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const agent = await loggedInAgent();

    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/^session=;/);

    await agent.get("/api/auth/me").expect(401);
  });

  it("returns 204 when not logged in", async () => {
    await request(app).post("/api/auth/logout").expect(204);
  });
});
