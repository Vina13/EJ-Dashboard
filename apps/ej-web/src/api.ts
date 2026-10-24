import type { ApiResponse, EjUser, EjUserInput, LoginRequest } from "@repo/shared";

/** Error the API sends when the session is missing or expired; pages return to the login form on it. */
export const UNAUTHORIZED = "Belum login";

/** Parses the API body; an unexpected server error (HTML 500) becomes a readable failure instead of throwing. */
async function readBody<T>(res: Response): Promise<ApiResponse<T>> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return { ok: false, error: `Terjadi kesalahan di server (HTTP ${res.status})` };
  }
}

// Relative URLs: Vite proxies /api to ej-api, so the httpOnly session cookie stays same-origin
async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init });
  return readBody<T>(res);
}

function sendJson<T>(method: string, path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getMe(): Promise<ApiResponse<EjUser>> {
  return request<EjUser>("/auth/me");
}

export function login(input: LoginRequest): Promise<ApiResponse<EjUser>> {
  return sendJson<EjUser>("POST", "/auth/login", input);
}

export async function logout(): Promise<void> {
  // 204 has no body, so this doesn't go through request()
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}

export function getUsers(): Promise<ApiResponse<EjUser[]>> {
  return request<EjUser[]>("/users");
}

export function createUser(input: EjUserInput): Promise<ApiResponse<EjUser>> {
  return sendJson<EjUser>("POST", "/users", input);
}

export function updateUser(id: number, input: EjUserInput): Promise<ApiResponse<EjUser>> {
  return sendJson<EjUser>("PUT", `/users/${id}`, input);
}

/** Returns null on success, or the error message. */
export async function deleteUser(id: number): Promise<string | null> {
  const res = await fetch(`/api/users/${id}`, { method: "DELETE", credentials: "same-origin" });
  if (res.status === 204) return null;
  const body = await readBody<never>(res);
  return body.ok ? null : body.error;
}
