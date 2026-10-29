import type { RequestHandler, Response } from "express";
import { canAccess, failure, type EjMenu } from "@repo/shared";
import type { StoredUser, UserRepo } from "../users";
import { SESSION_COOKIE, passwordStamp, verifyToken } from "./token";

export interface AuthLocals {
  user: StoredUser;
}

/**
 * Rejects with 401 unless the session cookie holds a valid token for an existing user
 * whose password hasn't changed since the token was issued. A valid request calls `renew`,
 * which issues a fresh token, so the session only ends after TOKEN_TTL_MS without requests.
 */
export function requireAuth(
  users: UserRepo,
  secret: string,
  now: () => number,
  renew: (res: Response, user: StoredUser) => void,
): RequestHandler {
  return (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const session = typeof token === "string" ? verifyToken(token, secret, now()) : null;
    const user = session === null ? undefined : users.findById(session.userId);
    if (!user || session?.passwordStamp !== passwordStamp(user.passwordHash)) {
      res.status(401).json(failure("Belum login"));
      return;
    }
    (res.locals as AuthLocals).user = user;
    renew(res, user);
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

/** Use after requireAuth: only roles that may open `menu` in FSD Tabel 6.1 (MENU_ACCESS) pass. */
export function requireMenu(menu: EjMenu): RequestHandler {
  return (_req, res, next) => {
    if (!canAccess((res.locals as AuthLocals).user.role, menu)) {
      res.status(403).json(failure(MENU_DENIED[menu]));
      return;
    }
    next();
  };
}

const MENU_DENIED: Record<EjMenu, string> = {
  home: "Tidak punya akses ke Home",
  "daily-report": "Hanya admin yang boleh melihat Daily Report & Performance",
  "user-management": "Hanya admin yang boleh mengelola user",
  "merge-ej": "Tidak punya akses ke Merge EJ",
  "ej-parsing": "Tidak punya akses ke EJ Parsing",
};
