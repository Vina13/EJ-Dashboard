import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { failure, success, type User } from "@repo/shared";
import { LoginForm } from "./LoginForm";

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it('shows "Email atau password salah" when the API responds 401', async () => {
    const fetchMock = mockFetch(401, failure("Email atau password salah"));
    render(<LoginForm />);

    fillAndSubmit("ana@example.com", "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email atau password salah");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "ana@example.com", password: "wrong-password" }),
      }),
    );
  });

  it("calls onSuccess with the user on 200", async () => {
    const user: User = { id: 1, name: "Ana", email: "ana@example.com" };
    mockFetch(200, success(user));
    const onSuccess = vi.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    fillAndSubmit("ana@example.com", "password123");

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(user));
    await waitFor(() => expect(screen.getByRole("button", { name: "Masuk" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("validates the email before calling the API", async () => {
    const fetchMock = mockFetch(200, success(null));
    render(<LoginForm />);

    fillAndSubmit("not-an-email", "password123");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email tidak valid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a connection error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginForm />);

    fillAndSubmit("ana@example.com", "password123");

    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal terhubung ke server");
  });
});
