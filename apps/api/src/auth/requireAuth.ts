import type { RequestHandler } from "express";
import { failure } from "@repo/shared";
import { SESSION_COOKIE, verifyToken } from "./token";
import { findUserById, type StoredUser } from "./users";

export interface AuthLocals {
  user: StoredUser;
}

/** Rejects with 401 unless the session cookie holds a valid token for an existing user. */
export function requireAuth(secret: string, now: () => number): RequestHandler {
  return (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const userId = typeof token === "string" ? verifyToken(token, secret, now()) : null;
    const user = userId === null ? undefined : findUserById(userId);
    if (!user) {
      res.status(401).json(failure("Belum login"));
      return;
    }
    (res.locals as AuthLocals).user = user;
    next();
  };
}
