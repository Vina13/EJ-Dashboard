import { MAX_PASSWORD_LENGTH, normalizeEmail } from "./index";

// Types and validation for the EJ Dashboard app (apps/ej-api + apps/ej-web)

export const EJ_ROLES = ["admin", "monitoring", "vendor"] as const;
export type EjRole = (typeof EJ_ROLES)[number];

/** Role names as the FSD writes them. */
export const EJ_ROLE_LABELS: Record<EjRole, string> = {
  admin: "Administrator",
  monitoring: "User Monitoring",
  vendor: "User Vendor",
};

/** Menus from FSD Tabel 6.1; the web uses them as hash routes (#/daily-report). */
export const EJ_MENUS = ["home", "daily-report", "user-management", "merge-ej", "ej-parsing"] as const;
export type EjMenu = (typeof EJ_MENUS)[number];

/** FSD Tabel 6.1 Authorization: which roles may open each menu. API guards and the sidebar both read this. */
export const MENU_ACCESS: Record<EjMenu, readonly EjRole[]> = {
  home: EJ_ROLES,
  "daily-report": ["admin"],
  "user-management": ["admin"],
  "merge-ej": EJ_ROLES,
  // Not in FSD Tabel 6.1 yet; open to every role until the FSD says otherwise (PRD § 8)
  "ej-parsing": EJ_ROLES,
};

export function canAccess(role: EjRole, menu: EjMenu): boolean {
  return MENU_ACCESS[menu].includes(role);
}

/** FSD flowchart: after "Berhasil Login" admins see Daily Report & Performance, other roles see Home. */
export function landingMenu(role: EjRole): EjMenu {
  return canAccess(role, "daily-report") ? "daily-report" : "home";
}

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
