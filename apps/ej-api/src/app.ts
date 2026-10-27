import type { DatabaseSync } from "node:sqlite";
import cookieParser from "cookie-parser";
import express, { type CookieOptions, type ErrorRequestHandler, type Response } from "express";
import {
  MAX_EJ_FILE_BYTES,
  failure,
  normalizeEmail,
  success,
  validateEjUserInput,
  validateLoginInput,
  type EjUserInput,
  type HealthResponse,
  type LoginRequest,
} from "@repo/shared";
import { hashPassword, hashPasswordAsync, verifyPassword } from "./auth/password";
import { createRateLimiter } from "./auth/rateLimit";
import { requireAdmin, requireAuth, type AuthLocals } from "./auth/requireAuth";
import { SESSION_COOKIE, TOKEN_TTL_MS, passwordStamp, signToken } from "./auth/token";
import { createEjRouter } from "./ejRoutes";
import type { EjStore } from "./ejStore";
import { createMachineRepo } from "./machines";
import { createUserRepo, toPublicUser } from "./users";

export interface AppOptions {
  authSecret: string;
  db: DatabaseSync;
  /** Where the raw EJ files live (ejStore.ts). */
  ejStore: EjStore;
  /** Injectable clock so tests can control token expiry and rate-limit windows. */
  now?: () => number;
}

/** Compared against when the email is unknown, so response timing doesn't reveal which emails exist. */
const DUMMY_HASH = hashPassword("dummy-password");

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message);
}

function parseId(raw: string | string[], res: Response): number | null {
  const id = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json(failure("User tidak ditemukan"));
    return null;
  }
  return id;
}

export function createApp({ authSecret, db, ejStore, now = Date.now }: AppOptions) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const users = createUserRepo(db, now);
  const auth = requireAuth(users, authSecret, now);
  const loginLimiter = createRateLimiter({ now });
  const sessionCookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { status: "ok", timestamp: new Date().toISOString() };
    res.json(body);
  });

  // --- Auth (flowchart: Log In → "Apakah Data Valid?" → Berhasil Login) ---

  app.post("/api/auth/login", async (req, res) => {
    const error = validateLoginInput(req.body);
    if (error) {
      res.status(400).json(failure(error));
      return;
    }

    const { password } = req.body as LoginRequest;
    const email = normalizeEmail((req.body as LoginRequest).email);
    const limitKey = `${req.ip}|${email}`;
    if (loginLimiter.isBlocked(limitKey)) {
      res.status(429).json(failure("Terlalu banyak percobaan login. Coba lagi nanti."));
      return;
    }

    const user = users.findByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      loginLimiter.recordFailure(limitKey);
      res.status(401).json(failure("Email atau password salah"));
      return;
    }

    loginLimiter.reset(limitKey);
    res.cookie(SESSION_COOKIE, signToken(user.id, passwordStamp(user.passwordHash), authSecret, now()), {
      ...sessionCookieOptions,
      maxAge: TOKEN_TTL_MS,
    });
    res.json(success(toPublicUser(user)));
  });

  app.get("/api/auth/me", auth, (_req, res) => {
    res.json(success(toPublicUser((res.locals as AuthLocals).user)));
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    res.status(204).end();
  });

  // --- User Management (flowchart: Create User, Edit User, Delete User) ---

  app.get("/api/users", auth, (_req, res) => {
    res.json(success(users.list().map(toPublicUser)));
  });

  app.get("/api/users/:id", auth, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const user = users.findById(id);
    if (!user) {
      res.status(404).json(failure("User tidak ditemukan"));
      return;
    }
    res.json(success(toPublicUser(user)));
  });

  app.post("/api/users", auth, requireAdmin, async (req, res) => {
    const error = validateEjUserInput(req.body, "create");
    if (error) {
      res.status(400).json(failure(error));
      return;
    }
    const input = req.body as EjUserInput;
    try {
      const user = users.create({
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        role: input.role,
        passwordHash: await hashPasswordAsync(input.password!),
      });
      res.status(201).json(success(toPublicUser(user)));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      res.status(409).json(failure("Email sudah terdaftar"));
    }
  });

  app.put("/api/users/:id", auth, requireAdmin, async (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const error = validateEjUserInput(req.body, "edit");
    if (error) {
      res.status(400).json(failure(error));
      return;
    }
    const input = req.body as EjUserInput;
    const self = (res.locals as AuthLocals).user;
    if (id === self.id && input.role !== "admin") {
      res.status(400).json(failure("Tidak bisa menurunkan role akun sendiri"));
      return;
    }
    try {
      const user = users.update(id, {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        role: input.role,
        passwordHash: input.password ? await hashPasswordAsync(input.password) : undefined,
      });
      if (!user) {
        res.status(404).json(failure("User tidak ditemukan"));
        return;
      }
      res.json(success(toPublicUser(user)));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      res.status(409).json(failure("Email sudah terdaftar"));
    }
  });

  app.delete("/api/users/:id", auth, requireAdmin, (req, res) => {
    const id = parseId(req.params.id, res);
    if (id === null) return;
    if (id === (res.locals as AuthLocals).user.id) {
      res.status(400).json(failure("Tidak bisa menghapus akun sendiri"));
      return;
    }
    if (!users.remove(id)) {
      res.status(404).json(failure("User tidak ditemukan"));
      return;
    }
    res.status(204).end();
  });

  // --- EJ menus: Home, Daily Report, Merge EJ, EJ Parsing, Upload EJ ---

  app.use("/api", createEjRouter({ machines: createMachineRepo(db), store: ejStore, auth }));

  const handleErrors: ErrorRequestHandler = (err, _req, res, next) => {
    if (err?.type === "entity.parse.failed") {
      res.status(400).json(failure("Body JSON tidak valid"));
      return;
    }
    if (err?.type === "entity.too.large") {
      res.status(413).json(failure(`File maksimal ${MAX_EJ_FILE_BYTES / 1024 / 1024} MB`));
      return;
    }
    next(err);
  };
  app.use(handleErrors);

  return app;
}
