import { fireEvent, render, screen } from "@testing-library/react";
import { failure, success, type User } from "@repo/shared";
import { App } from "./App";

const ANA: User = { id: 1, name: "Ana", email: "ana@example.com" };
const BUDI: User = { id: 2, name: "Budi", email: "budi@example.com" };

type Route = { status: number; body?: unknown };

/** Mocks fetch by "METHOD /path"; routes can be swapped mid-test. */
function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const route = routes[key];
    if (!route) throw new Error(`Unmocked request: ${key}`);
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: () => Promise.resolve(route.body),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, routes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows the login form when not logged in", async () => {
    mockApi({ "GET /api/auth/me": { status: 401, body: failure("Belum login") } });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows the login form when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();
  });

  it("shows the user list when already logged in", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ANA) },
      "GET /api/users": { status: 200, body: success([ANA, BUDI]) },
    });
    render(<App />);

    expect(await screen.findByText("Budi (budi@example.com)")).toBeInTheDocument();
    expect(screen.getByText(/Halo, Ana/)).toBeInTheDocument();
  });

  it("logs in through the form and then shows the user list", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: failure("Belum login") },
      "POST /api/auth/login": { status: 200, body: success(ANA) },
      "GET /api/users": { status: 200, body: success([ANA]) },
    });
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: ANA.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    expect(await screen.findByText("Ana (ana@example.com)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
  });

  it("returns to the login form after logout", async () => {
    const { fetchMock } = mockApi({
      "GET /api/auth/me": { status: 200, body: success(ANA) },
      "GET /api/users": { status: 200, body: success([ANA]) },
      "POST /api/auth/logout": { status: 204 },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Keluar" }));

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns to the login form when the session expired before loading users", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ANA) },
      "GET /api/users": { status: 401, body: failure("Belum login") },
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();
  });
});
