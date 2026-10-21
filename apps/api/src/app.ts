import cookieParser from "cookie-parser";
import express, { type CookieOptions, type ErrorRequestHandler } from "express";
import {
  failure,
  normalizeEmail,
  success,
  validateLoginInput,
  type ApiResponse,
  type HealthResponse,
  type LoginRequest,
  type User,
} from "@repo/shared";
import { verifyPassword } from "./auth/password";
import { createRateLimiter } from "./auth/rateLimit";
import { requireAuth, type AuthLocals } from "./auth/requireAuth";
import { SESSION_COOKIE, TOKEN_TTL_MS, signToken } from "./auth/token";
import { DUMMY_HASH, findUserByEmail, findUserById, toPublicUser, users } from "./auth/users";

export interface AppOptions {
  authSecret: string;
  /** Injectable clock so tests can control token expiry and rate-limit windows. */
  now?: () => number;
}

export function createApp({ authSecret, now = Date.now }: AppOptions) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const auth = requireAuth(authSecret, now);
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

  app.get("/api/users", auth, (_req, res) => {
    const body: ApiResponse<User[]> = success(users.map(toPublicUser));
    res.json(body);
  });

  app.get("/api/users/:id", auth, (req, res) => {
    const user = findUserById(Number(req.params.id));
    if (!user) {
      res.status(404).json(failure("User not found"));
      return;
    }
    res.json(success(toPublicUser(user)));
  });

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

    const user = findUserByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      loginLimiter.recordFailure(limitKey);
      res.status(401).json(failure("Email atau password salah"));
      return;
    }

    loginLimiter.reset(limitKey);
    res.cookie(SESSION_COOKIE, signToken(user.id, authSecret, now()), {
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

  const handleErrors: ErrorRequestHandler = (err, _req, res, next) => {
    if (err?.type === "entity.parse.failed") {
      res.status(400).json(failure("Body JSON tidak valid"));
      return;
    }
    next(err);
  };
  app.use(handleErrors);

  return app;
}
