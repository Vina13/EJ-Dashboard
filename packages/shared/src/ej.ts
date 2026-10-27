import { MAX_PASSWORD_LENGTH, normalizeEmail } from "./index";

// Types and validation for the EJ Dashboard app (apps/ej-api + apps/ej-web)

export const EJ_ROLES = ["admin", "monitoring"] as const;
export type EjRole = (typeof EJ_ROLES)[number];

export interface EjUser {
  id: number;
  name: string;
  email: string;
  role: EjRole;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /api/users; on PUT the password may be left empty to keep the current one. */
export interface EjUserInput {
  name: string;
  email: string;
  role: EjRole;
  password?: string;
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 100;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message, or null when the input is a valid EjUserInput. */
export function validateEjUserInput(input: unknown, mode: "create" | "edit"): string | null {
  if (typeof input !== "object" || input === null) return "Request tidak valid";
  const { name, email, role, password } = input as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) return "Nama wajib diisi";
  if (name.trim().length > MAX_NAME_LENGTH) return `Nama maksimal ${MAX_NAME_LENGTH} karakter`;
  if (typeof email !== "string" || !EMAIL_PATTERN.test(normalizeEmail(email))) {
    return "Email tidak valid";
  }
  if (typeof role !== "string" || !(EJ_ROLES as readonly string[]).includes(role)) {
    return "Role tidak valid";
  }

  const passwordGiven = typeof password === "string" && password.length > 0;
  if (mode === "create" && !passwordGiven) return "Password wajib diisi";
  if (password !== undefined && typeof password !== "string") return "Password tidak valid";
  if (passwordGiven && (password as string).length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (passwordGiven && (password as string).length > MAX_PASSWORD_LENGTH) {
    return "Password terlalu panjang";
  }
  return null;
}
