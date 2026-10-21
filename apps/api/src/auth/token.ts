import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const TOKEN_TTL_MS = 60 * 60 * 1000;

interface TokenPayload {
  sub: number;
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). */
export function signToken(userId: number, secret: string, now = Date.now()): string {
  const body: TokenPayload = { sub: userId, exp: now + TOKEN_TTL_MS };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id, or null when the token is malformed, tampered with or expired. */
export function verifyToken(token: string, secret: string, now = Date.now()): number | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenPayload;
    if (typeof data.sub !== "number" || typeof data.exp !== "number") return null;
    return data.exp > now ? data.sub : null;
  } catch {
    return null;
  }
}
