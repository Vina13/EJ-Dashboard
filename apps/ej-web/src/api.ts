import type {
  ApiResponse,
  DailyReport,
  EjPreview,
  EjTransactionList,
  EjUser,
  EjUserInput,
  LoginRequest,
  Machine,
  MergeEjRequest,
  UploadEjResult,
} from "@repo/shared";

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

/** "?a=1&b=2" from the defined values only, or "" when there are none. */
function query(params: Record<string, string | undefined>): string {
  const defined = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return defined.length === 0 ? "" : `?${new URLSearchParams(defined)}`;
}

export function getMachines(): Promise<ApiResponse<Machine[]>> {
  return request<Machine[]>("/machines");
}

/** Without a date the API returns the machine's latest day. */
export function getEjPreview(terminalId: string, date?: string): Promise<ApiResponse<EjPreview>> {
  return request<EjPreview>(`/machines/${encodeURIComponent(terminalId)}/ej${query({ date })}`);
}

export function getDailyReport(date?: string): Promise<ApiResponse<DailyReport>> {
  return request<DailyReport>(`/reports/daily${query({ date })}`);
}

export function getTransactions(date?: string, terminalId?: string): Promise<ApiResponse<EjTransactionList>> {
  return request<EjTransactionList>(`/ej/transactions${query({ date, terminalId })}`);
}

export interface Download {
  fileName: string;
  blob: Blob;
}

/** The merged EJ file, or the API's error message. */
export async function mergeEj(input: MergeEjRequest): Promise<ApiResponse<Download>> {
  const res = await fetch("/api/ej/merge", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return readBody<never>(res);
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `EJ_${input.terminalId}.txt`;
  return { ok: true, data: { fileName, blob: await res.blob() } };
}

/** Sends the file as the raw body; terminal, day and name go in the query string. */
export function uploadEj(file: File, terminalId: string, date: string): Promise<ApiResponse<UploadEjResult>> {
  return request<UploadEjResult>(`/ej/upload${query({ terminalId, date, fileName: file.name })}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
}
