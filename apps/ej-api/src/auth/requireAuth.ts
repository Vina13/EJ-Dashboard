import type { RequestHandler } from "express";
import { failure } from "@repo/shared";
import type { StoredUser, UserRepo } from "../users";
import { SESSION_COOKIE, passwordStamp, verifyToken } from "./token";

export interface AuthLocals {
  user: StoredUser;
}

/**
 * Rejects with 401 unless the session cookie holds a valid token for an existing user
 * whose password hasn't changed since the token was issued.
 */
export function requireAuth(users: UserRepo, secret: string, now: () => number): RequestHandler {
  return (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const session = typeof token === "string" ? verifyToken(token, secret, now()) : null;
    const user = session === null ? undefined : users.findById(session.userId);
    if (!user || session?.passwordStamp !== passwordStamp(user.passwordHash)) {
      res.status(401).json(failure("Belum login"));
      return;
    }
    (res.locals as AuthLocals).user = user;
    next();
  };
}

/** Use after requireAuth: only admins pass; `message` says what the user tried to do. */
export function adminOnly(message: string): RequestHandler {
  return (_req, res, next) => {
    if ((res.locals as AuthLocals).user.role !== "admin") {
      res.status(403).json(failure(message));
      return;
    }
    next();
  };
}

/** Only admins may change users. */
export const requireAdmin = adminOnly("Hanya admin yang boleh mengelola user");
