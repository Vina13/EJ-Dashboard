import type { ApiResponse, LoginRequest, User } from "@repo/shared";

// Relative URLs: Vite proxies /api to the API, so the httpOnly session cookie stays same-origin
async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init });
  return (await res.json()) as ApiResponse<T>;
}

export function getMe(): Promise<ApiResponse<User>> {
  return request<User>("/auth/me");
}

export function getUsers(): Promise<ApiResponse<User[]>> {
  return request<User[]>("/users");
}

export function login(input: LoginRequest): Promise<ApiResponse<User>> {
  return request<User>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  // 204 has no body, so this doesn't go through request()
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}
