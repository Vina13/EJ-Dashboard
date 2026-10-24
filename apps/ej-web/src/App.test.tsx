import { fireEvent, render, screen, within } from "@testing-library/react";
import { failure, success, type EjUser } from "@repo/shared";
import { App } from "./App";

const ADMIN: EjUser = {
  id: 1,
  name: "Administrator",
  email: "admin@ejdashboard.local",
  role: "admin",
  createdAt: "2026-10-24T07:00:00.000Z",
  updatedAt: "2026-10-24T07:00:00.000Z",
};
const VINA: EjUser = { ...ADMIN, id: 2, name: "Vina", email: "vina@example.com", role: "monitoring" };

type Route = { status: number; body?: unknown };

/** Mocks fetch by "METHOD /path"; a route may be a list, answered in order. */
function mockApi(routes: Record<string, Route | Route[]>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const entry = routes[key];
    if (!entry) throw new Error(`Unmocked request: ${key}`);
    const route = Array.isArray(entry) ? (entry.length > 1 ? entry.shift()! : entry[0]) : entry;
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: () => Promise.resolve(route.body),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fillLogin(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("login (flowchart: Apakah Data Valid?)", () => {
  it("[REQ-AUTH-002] stays on the login page with an error when the credentials are wrong", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: failure("Belum login") },
      "POST /api/auth/login": { status: 401, body: failure("Email atau password salah") },
    });
    render(<App />);
    await screen.findByRole("heading", { name: "EJ Dashboard" });

    fillLogin(ADMIN.email, "salah-password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email atau password salah");
    expect(screen.getByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });

  it("[REQ-AUTH-001][REQ-RPT-001] lands on Daily Report & Performance after a successful login", async () => {
    window.location.hash = "/merge-ej";
    mockApi({
      "GET /api/auth/me": { status: 401, body: failure("Belum login") },
      "POST /api/auth/login": { status: 200, body: success(ADMIN) },
    });
    render(<App />);
    await screen.findByLabelText("Email");

    fillLogin(ADMIN.email, "Admin12345");

    expect(await screen.findByRole("heading", { level: 1, name: "Daily Report & Performance" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/daily-report");
  });
});

describe("menu", () => {
  it("[REQ-HOME-001][REQ-MERGE-001][REQ-PARSE-001][REQ-UPLOAD-001] opens each menu and submenu", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": { status: 200, body: success([ADMIN]) },
    });
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Menu utama" });

    fireEvent.click(within(nav).getByRole("button", { name: "Home" }));
    expect(screen.getByRole("heading", { name: /EJ Preview/ })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /^User/ }));
    fireEvent.click(within(nav).getByRole("button", { name: "User Management" }));
    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: "Merge EJ" }));
    expect(screen.getByRole("heading", { level: 1, name: "Merge EJ" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: "EJ Parsing" }));
    expect(screen.getByRole("heading", { name: "Hasil EJ Parsing" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /^Upload EJ Parsing/ }));
    fireEvent.click(within(nav).getByRole("button", { name: "Upload EJ" }));
    expect(screen.getByRole("heading", { level: 1, name: "Upload EJ" })).toBeInTheDocument();
  });

  it("[REQ-HOME-001][REQ-RPT-001] marks pages with sample data", async () => {
    mockApi({ "GET /api/auth/me": { status: 200, body: success(ADMIN) } });
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Menu utama" });

    expect(screen.getByText(/^Data contoh/)).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: "Home" }));
    expect(screen.getByText(/^Data contoh/)).toBeInTheDocument();
  });

  it("[REQ-AUTH-004] returns to the login page after logout", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "POST /api/auth/logout": { status: 204 },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Keluar" }));
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });
});

describe("User Management", () => {
  beforeEach(() => {
    window.location.hash = "/user-management";
  });

  it("[REQ-USER-002] validates Create User input before calling the API", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": { status: 200, body: success([ADMIN]) },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create User" }));
    const form = screen.getByRole("form", { name: "Create User" });
    fireEvent.change(within(form).getByLabelText("Nama"), { target: { value: "Vina" } });
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "vina@example.com" } });
    fireEvent.change(within(form).getByLabelText("Password"), { target: { value: "pendek" } });
    fireEvent.click(within(form).getByRole("button", { name: "Simpan" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Password minimal 8 karakter");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/users", expect.objectContaining({ method: "POST" }));
  });

  it("[REQ-USER-001][REQ-USER-002] creates a user and shows it in the list", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": [
        { status: 200, body: success([ADMIN]) },
        { status: 200, body: success([ADMIN, VINA]) },
      ],
      "POST /api/users": { status: 201, body: success(VINA) },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create User" }));
    const form = screen.getByRole("form", { name: "Create User" });
    fireEvent.change(within(form).getByLabelText("Nama"), { target: { value: "Vina" } });
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "vina@example.com" } });
    fireEvent.change(within(form).getByLabelText("Password"), { target: { value: "rahasia123" } });
    fireEvent.click(within(form).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Data user Vina berhasil tersimpan");
    expect(await screen.findByText("vina@example.com")).toBeInTheDocument();
  });

  it("[REQ-USER-003] does not call the API when an edit changes nothing", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": { status: 200, body: success([ADMIN, VINA]) },
    });
    render(<App />);

    const row = (await screen.findByText(VINA.email)).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Edit User" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Tidak ada perubahan data");
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/users/${VINA.id}`, expect.anything());
  });

  it("[REQ-USER-004] deletes a user after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": [
        { status: 200, body: success([ADMIN, VINA]) },
        { status: 200, body: success([ADMIN]) },
      ],
      [`DELETE /api/users/${VINA.id}`]: { status: 204 },
    });
    render(<App />);

    const row = (await screen.findByText(VINA.email)).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete User" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Data user Vina berhasil terhapus");
    expect(screen.queryByText(VINA.email)).not.toBeInTheDocument();
  });

  it("[REQ-USER-005] hides the change buttons from monitoring users", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(VINA) },
      "GET /api/users": { status: 200, body: success([ADMIN, VINA]) },
    });
    render(<App />);

    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create User" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete User" })).not.toBeInTheDocument();
  });

  it("[REQ-AUTH-005] returns to the login page when the session expired before saving", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": { status: 200, body: success([ADMIN]) },
      "POST /api/users": { status: 401, body: failure("Belum login") },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create User" }));
    const form = screen.getByRole("form", { name: "Create User" });
    fireEvent.change(within(form).getByLabelText("Nama"), { target: { value: "Vina" } });
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "vina@example.com" } });
    fireEvent.change(within(form).getByLabelText("Password"), { target: { value: "rahasia123" } });
    fireEvent.click(within(form).getByRole("button", { name: "Simpan" }));

    expect(await screen.findByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });

  it("[REQ-USER-002] shows a server error instead of a connection error when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const key = `${init?.method ?? "GET"} ${url}`;
        if (key === "GET /api/auth/me") return { ok: true, status: 200, json: async () => success(ADMIN) };
        if (key === "GET /api/users") return { ok: true, status: 200, json: async () => success([ADMIN]) };
        // Express answers an unexpected error with an HTML page
        return { ok: false, status: 500, json: async () => JSON.parse("<!DOCTYPE html>") };
      }),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Create User" }));
    const form = screen.getByRole("form", { name: "Create User" });
    fireEvent.change(within(form).getByLabelText("Nama"), { target: { value: "Vina" } });
    fireEvent.change(within(form).getByLabelText("Email"), { target: { value: "vina@example.com" } });
    fireEvent.change(within(form).getByLabelText("Password"), { target: { value: "rahasia123" } });
    fireEvent.click(within(form).getByRole("button", { name: "Simpan" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("Terjadi kesalahan di server (HTTP 500)");
  });
});
