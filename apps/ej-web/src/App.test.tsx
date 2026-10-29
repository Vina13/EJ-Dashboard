import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { failure, success, type DailyReport, type EjTransactionList, type EjUser, type Machine } from "@repo/shared";
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
const VENDOR: EjUser = { ...ADMIN, id: 3, name: "Vendor", email: "vendor@example.com", role: "vendor" };

const MACHINES: Machine[] = [
  { terminalId: "S1A0101", location: "KCP Sudirman, Jakarta", type: "ATM", status: "Online", lastEjAt: "2026-10-24 20:51" },
  { terminalId: "S1A0418", location: "KCP Medan Merdeka", type: "ATM", status: "Offline", lastEjAt: "2026-10-23 20:12" },
];
const REPORT: DailyReport = {
  date: "2026-10-24",
  availableDates: ["2026-10-23", "2026-10-24"],
  machines: { total: 2, online: 1, problem: 0, offline: 1 },
  rows: [
    { terminalId: "S1A0101", location: "KCP Sudirman, Jakarta", transactions: 20, failed: 4 },
    { terminalId: "S1A0418", location: "KCP Medan Merdeka", transactions: 0, failed: 0 },
  ],
};
const TRANSACTIONS: EjTransactionList = {
  date: "2026-10-24",
  availableDates: ["2026-10-24"],
  rows: [
    { date: "2026-10-24", time: "08:01:26", terminalId: "S1A0101", transaction: "Tarik Tunai", amount: 1500000, rc: "00" },
    { date: "2026-10-24", time: "08:05:10", terminalId: "S1A0101", transaction: "Cek Saldo", amount: null, rc: "51" },
  ],
};
const EJ_TEXT = "*** ELECTRONIC JOURNAL S1A0101 ***\n08:01:26 TRANSACTION: TARIK TUNAI";

type Route = { status: number; body?: unknown; headers?: Record<string, string> };

/** What the EJ menus load when they open. */
const EJ_ROUTES: Record<string, Route> = {
  "GET /api/machines": { status: 200, body: success(MACHINES) },
  "GET /api/machines/S1A0101/ej": { status: 200, body: success({ terminalId: "S1A0101", date: "2026-10-24", text: EJ_TEXT }) },
  "GET /api/reports/daily": { status: 200, body: success(REPORT) },
  "GET /api/ej/transactions": { status: 200, body: success(TRANSACTIONS) },
};

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
      headers: new Headers(route.headers),
      json: () => Promise.resolve(route.body),
      blob: () => Promise.resolve(new Blob([String(route.body)])),
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

  it("[REQ-AUTH-001] lands vendor users on Home after a successful login", async () => {
    window.location.hash = "/merge-ej";
    mockApi({
      "GET /api/auth/me": { status: 401, body: failure("Belum login") },
      "POST /api/auth/login": { status: 200, body: success(VENDOR) },
      ...EJ_ROUTES,
    });
    render(<App />);
    await screen.findByLabelText("Email");

    fillLogin(VENDOR.email, "vendor12345");

    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/home");
  });

  it("[REQ-AUTH-001][REQ-RPT-001] lands admins on Daily Report & Performance after a successful login", async () => {
    window.location.hash = "/merge-ej";
    mockApi({
      "GET /api/auth/me": { status: 401, body: failure("Belum login") },
      "POST /api/auth/login": { status: 200, body: success(ADMIN) },
      "GET /api/reports/daily": { status: 200, body: success(REPORT) },
    });
    render(<App />);
    await screen.findByLabelText("Email");

    fillLogin(ADMIN.email, "Admin12345");

    expect(await screen.findByRole("heading", { level: 1, name: "Daily Report & Performance" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/daily-report");
  });
});

describe("menu", () => {
  it("[REQ-HOME-001][REQ-MERGE-001] opens each menu and submenu", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/users": { status: 200, body: success([ADMIN]) },
      ...EJ_ROUTES,
    });
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Menu utama" });

    fireEvent.click(within(nav).getByRole("button", { name: "Home" }));
    expect(await screen.findByRole("heading", { name: /EJ Preview/ })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /^User/ }));
    fireEvent.click(within(nav).getByRole("button", { name: "User Management" }));
    expect(await screen.findByText(ADMIN.email)).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: "Merge EJ" }));
    expect(screen.getByRole("heading", { level: 1, name: "Merge EJ" })).toBeInTheDocument();

    expect(within(nav).queryByRole("button", { name: /EJ Parsing|Upload EJ/ })).not.toBeInTheDocument();
  });

  it("[REQ-AUTH-004] returns to the login page after logout", async () => {
    mockApi({
      "GET /api/auth/me": { status: 200, body: success(ADMIN) },
      "GET /api/reports/daily": { status: 200, body: success(REPORT) },
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

  it.each([VINA, VENDOR])(
    "[REQ-AUTH-007][REQ-USER-005][REQ-RPT-001] shows $role users only Home and Merge EJ",
    async (user) => {
      window.location.hash = "/user-management";
      mockApi({ "GET /api/auth/me": { status: 200, body: success(user) }, ...EJ_ROUTES });
      render(<App />);
      const nav = await screen.findByRole("navigation", { name: "Menu utama" });

      // Opening a menu the role may not see goes to the role's landing page instead
      expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
      expect(window.location.hash).toBe("#/home");
      expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Home", "Merge EJ"]);
    },
  );

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

describe("EJ menus read from the API", () => {
  function openAs(user: EjUser, hash: string, routes: Record<string, Route | Route[]> = {}) {
    window.location.hash = hash;
    const fetchMock = mockApi({ "GET /api/auth/me": { status: 200, body: success(user) }, ...EJ_ROUTES, ...routes });
    render(<App />);
    return fetchMock;
  }

  it("[REQ-RPT-001] shows the Daily Report counted by the server", async () => {
    openAs(ADMIN, "/daily-report");

    const total = (await screen.findByText("Total transaksi")).closest(".tile")!;
    expect(total).toHaveTextContent("20");
    expect(screen.getByText("1 dari 2")).toBeInTheDocument();
    expect(screen.getByText("Tingkat sukses").closest(".tile")).toHaveTextContent("80%");
    expect(screen.getByLabelText("Tanggal laporan")).toHaveValue("2026-10-24");
  });

  it("[REQ-RPT-002] loads another day when a date is chosen", async () => {
    const fetchMock = openAs(ADMIN, "/daily-report", {
      "GET /api/reports/daily?date=2026-10-23": { status: 200, body: success({ ...REPORT, date: "2026-10-23" }) },
    });

    fireEvent.change(await screen.findByLabelText("Tanggal laporan"), { target: { value: "2026-10-23" } });

    await waitFor(() => expect(screen.getByLabelText("Tanggal laporan")).toHaveValue("2026-10-23"));
    expect(fetchMock).toHaveBeenCalledWith("/api/reports/daily?date=2026-10-23", expect.anything());
  });

  it("[REQ-HOME-001][REQ-HOME-002] lists machines and previews the EJ of the first one", async () => {
    openAs(ADMIN, "/home");

    expect(await screen.findByText("2026-10-23 20:12")).toBeInTheDocument();
    expect(await screen.findByLabelText("EJ Preview")).toHaveTextContent("ELECTRONIC JOURNAL S1A0101");
  });

  it("[REQ-HOME-002] explains when a machine has no EJ yet", async () => {
    openAs(ADMIN, "/home", {
      "GET /api/machines/S1A0418/ej": { status: 404, body: failure("Belum ada file EJ untuk S1A0418") },
    });

    fireEvent.click(await screen.findByRole("button", { name: "S1A0418" }));

    expect(await screen.findByText("Belum ada file EJ untuk S1A0418")).toBeInTheDocument();
    expect(screen.queryByLabelText("EJ Preview")).not.toBeInTheDocument();
  });

  it("[REQ-MERGE-001] downloads the merged EJ file", async () => {
    const createObjectURL = vi.fn(() => "blob:merged");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchMock = openAs(ADMIN, "/merge-ej", {
      "POST /api/ej/merge": {
        status: 200,
        body: EJ_TEXT,
        headers: { "Content-Disposition": "attachment; filename=EJ_S1A0101_20261020-20261024.txt" },
      },
    });

    await waitFor(() => expect(screen.getByLabelText("Dari tanggal")).toHaveValue("2026-10-20"));
    expect(screen.getByLabelText("Sampai tanggal")).toHaveValue("2026-10-24");
    fireEvent.click(within(screen.getByRole("form", { name: "Merge EJ" })).getByRole("button", { name: "Merge EJ" }));

    expect(await screen.findByRole("status")).toHaveTextContent("File EJ_S1A0101_20261020-20261024.txt berhasil dibuat");
    expect(click).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ej/merge",
      expect.objectContaining({ body: JSON.stringify({ terminalId: "S1A0101", from: "2026-10-20", to: "2026-10-24" }) }),
    );
  });

  it("[REQ-MERGE-001] checks the date range before calling the API, and shows server errors", async () => {
    const fetchMock = openAs(ADMIN, "/merge-ej", {
      "POST /api/ej/merge": { status: 404, body: failure("Tidak ada file EJ S1A0101 pada 2026-01-01 s.d. 2026-01-02") },
    });
    const form = await screen.findByRole("form", { name: "Merge EJ" });
    await waitFor(() => expect(within(form).getByLabelText("Dari tanggal")).toHaveValue("2026-10-20"));

    fireEvent.change(within(form).getByLabelText("Dari tanggal"), { target: { value: "2026-10-25" } });
    fireEvent.click(within(form).getByRole("button", { name: "Merge EJ" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/^Tanggal awal harus/);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/ej/merge", expect.anything());

    fireEvent.change(within(form).getByLabelText("Dari tanggal"), { target: { value: "2026-01-01" } });
    fireEvent.change(within(form).getByLabelText("Sampai tanggal"), { target: { value: "2026-01-02" } });
    fireEvent.click(within(form).getByRole("button", { name: "Merge EJ" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Tidak ada file EJ S1A0101 pada 2026-01-01 s.d. 2026-01-02");
  });

  it("[REQ-AUTH-005] returns to the login page when the session expired on an EJ menu", async () => {
    openAs(ADMIN, "/home", { "GET /api/machines": { status: 401, body: failure("Belum login") } });

    expect(await screen.findByRole("button", { name: "Masuk" })).toBeInTheDocument();
  });
});
