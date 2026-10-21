import { useCallback, useEffect, useState } from "react";
import type { User } from "@repo/shared";
import { getMe, getUsers, logout } from "./api";
import { LoginForm } from "./LoginForm";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const showLogin = useCallback(() => setAuth({ status: "anonymous" }), []);

  useEffect(() => {
    getMe()
      .then((body) => setAuth(body.ok ? { status: "authenticated", user: body.data } : { status: "anonymous" }))
      .catch(() => setAuth({ status: "anonymous" }));
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      // The cookie is httpOnly, so the UI can't confirm it was cleared; show the form either way
      setAuth({ status: "anonymous" });
    }
  }

  if (auth.status === "loading") return <p>Memuat…</p>;

  if (auth.status === "anonymous") {
    return (
      <main>
        <h1>Masuk</h1>
        <LoginForm onSuccess={(user) => setAuth({ status: "authenticated", user })} />
      </main>
    );
  }

  return (
    <main>
      <h1>Users</h1>
      <p>
        Halo, {auth.user.name} <button onClick={handleLogout}>Keluar</button>
      </p>
      <UserList onUnauthorized={showLogin} />
    </main>
  );
}

function UserList({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then((body) => {
        if (body.ok) setUsers(body.data);
        // Session expired between /auth/me and /users
        else if (body.error === "Belum login") onUnauthorized();
        else setError(body.error);
      })
      .catch(() => setError("Gagal memuat daftar user"));
  }, [onUnauthorized]);

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.name} ({u.email})
          </li>
        ))}
      </ul>
    </>
  );
}
