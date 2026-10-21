import request from "supertest";
import { isUser } from "@repo/shared";
import { createApp } from "./app";
import { DEMO_PASSWORD } from "./auth/users";

const app = createApp({ authSecret: "test-secret" });

async function loggedInAgent() {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ email: "ana@example.com", password: DEMO_PASSWORD })
    .expect(200);
  return agent;
}

describe("API", () => {
  it("GET /health is public", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/users returns 401 without login", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ ok: false, error: "Belum login" });
  });

  it("GET /api/users/:id returns 401 without login", async () => {
    await request(app).get("/api/users/1").expect(401);
  });

  it("GET /api/users returns a list of users", async () => {
    const agent = await loggedInAgent();
    const res = await agent.get("/api/users");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.every(isUser)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("GET /api/users/:id returns one user", async () => {
    const agent = await loggedInAgent();
    const res = await agent.get("/api/users/1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: { id: 1, name: "Ana", email: "ana@example.com" },
    });
  });

  it("GET /api/users/:id returns 404 for unknown id", async () => {
    const agent = await loggedInAgent();
    const res = await agent.get("/api/users/999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "User not found" });
  });
});
