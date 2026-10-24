import { useState, type FormEvent } from "react";
import { validateLoginInput, type EjUser, type LoginRequest } from "@repo/shared";
import { login } from "./api";

interface LoginPageProps {
  onSuccess: (user: EjUser) => void;
}

/** Flowchart: Log In → "Apakah Data Valid?" — "Tidak" keeps the user on this form with an error. */
export function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input: LoginRequest = { email, password };
    const validationError = validateLoginInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const body = await login(input);
      if (body.ok) onSuccess(body.data);
      else setError(body.error);
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <span className="brand-mark large" aria-hidden>
          EJ
        </span>
        <h1>EJ Dashboard</h1>
        <p className="muted">Masuk untuk melihat Daily Report &amp; Performance</p>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Memproses…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}
