import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ej_session";
/** FSD 6.2.4: logged out after 10 idle minutes; every authenticated request renews it (requireAuth). */
export const TOKEN_TTL_MS = 10 * 60 * 1000;

interface TokenPayload {
  sub: number;
  exp: number;
  /** passwordStamp() of the user's hash at login; a password change makes it stale. */
  pwd: string;
}

export interface Session {
  userId: number;
  passwordStamp: string;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Short fingerprint of a password hash, so tokens issued before a password change stop working. */
export function passwordStamp(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

/** Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export function signToken(userId: number, stamp: string, secret: string, now = Date.now()): string {
  const body: TokenPayload = { sub: userId, exp: now + TOKEN_TTL_MS, pwd: stamp };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the session, or null when the token is malformed, tampered with or expired. */
export function verifyToken(token: string, secret: string, now = Date.now()): Session | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenPayload;
    if (typeof data.sub !== "number" || typeof data.exp !== "number" || typeof data.pwd !== "string") return null;
    return data.exp > now ? { userId: data.sub, passwordStamp: data.pwd } : null;
  } catch {
    return null;
  }
}
