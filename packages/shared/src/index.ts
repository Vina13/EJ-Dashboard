export interface User {
  id: number;
  name: string;
  email: string;
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function success<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function failure(error: string): ApiResponse<never> {
  return { ok: false, error };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export const MAX_PASSWORD_LENGTH = 1024;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns an error message, or null when the input is a valid LoginRequest. */
export function validateLoginInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return "Request tidak valid";
  const { email, password } = input as Record<string, unknown>;
  if (typeof email !== "string" || !EMAIL_PATTERN.test(normalizeEmail(email))) {
    return "Email tidak valid";
  }
  if (typeof password !== "string" || password.length === 0) return "Password wajib diisi";
  // Caps the work scrypt does per request
  if (password.length > MAX_PASSWORD_LENGTH) return "Password terlalu panjang";
  return null;
}

export function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "number" &&
    typeof v.name === "string" &&
    typeof v.email === "string"
  );
}
