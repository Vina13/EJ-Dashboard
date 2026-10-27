import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EJ_ROLES, validateEjUserInput, type EjRole, type EjUser, type EjUserInput } from "@repo/shared";
import { UNAUTHORIZED, createUser, deleteUser, getUsers, updateUser } from "../api";

interface UserManagementPageProps {
  currentUser: EjUser;
  onUnauthorized: () => void;
}

type FormState = { mode: "create" } | { mode: "edit"; user: EjUser } | null;

/** Flowchart Gambar 3.4: Pilih Menu User → Create User / Edit User / Delete User. Backed by the database. */
export function UserManagementPage({ currentUser, onUnauthorized }: UserManagementPageProps) {
  const [users, setUsers] = useState<EjUser[]>([]);
  const [form, setForm] = useState<FormState>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = currentUser.role === "admin";

  // An expired session sends the user back to the login form instead of showing an error
  const showError = useCallback(
    (text: string) => (text === UNAUTHORIZED ? onUnauthorized() : setError(text)),
    [onUnauthorized],
  );

  const load = useCallback(() => {
    getUsers()
      .then((body) => {
        if (body.ok) setUsers(body.data);
        else showError(body.error);
      })
      .catch(() => setError("Gagal memuat daftar user"));
  }, [showError]);

  useEffect(load, [load]);

  async function handleDelete(user: EjUser) {
    if (!window.confirm(`Hapus user ${user.name} (${user.email})?`)) return;
    setError(null);
    try {
      const deleteError = await deleteUser(user.id);
      if (deleteError) {
        showError(deleteError);
        return;
      }
      setMessage(`Data user ${user.name} berhasil terhapus`);
      load();
    } catch {
      setError("Gagal terhubung ke server");
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="muted">{users.length} user terdaftar</p>
        {isAdmin && (
          <button
            className="primary"
            onClick={() => {
              setForm({ mode: "create" });
              setMessage(null);
            }}
          >
            Create User
          </button>
        )}
      </div>
      {!isAdmin && <p className="notice">Hanya admin yang dapat menambah, mengubah atau menghapus user.</p>}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {form && (
        <UserForm
          key={form.mode === "edit" ? form.user.id : "create"}
          initial={form.mode === "edit" ? form.user : undefined}
          onCancel={() => setForm(null)}
          onUnauthorized={onUnauthorized}
          onSaved={(text) => {
            setForm(null);
            setMessage(text);
            load();
          }}
        />
      )}

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Dibuat</th>
              {isAdmin && <th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="badge">{user.role}</span>
                </td>
                <td>{new Date(user.createdAt).toLocaleString("id-ID")}</td>
                {isAdmin && (
                  <td>
                    <div className="actions">
                      <button
                        onClick={() => {
                          setForm({ mode: "edit", user });
                          setMessage(null);
                        }}
                      >
                        Edit User
                      </button>
                      <button
                        className="danger"
                        disabled={user.id === currentUser.id}
                        title={user.id === currentUser.id ? "Tidak bisa menghapus akun sendiri" : undefined}
                        onClick={() => handleDelete(user)}
                      >
                        Delete User
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

interface UserFormProps {
  initial?: EjUser;
  onCancel: () => void;
  onSaved: (message: string) => void;
  onUnauthorized: () => void;
}

function UserForm({ initial, onCancel, onSaved, onUnauthorized }: UserFormProps) {
  const mode = initial ? "edit" : "create";
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<EjRole>(initial?.role ?? "monitoring");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input: EjUserInput = { name, email, role, password };

    // "Apakah Data Valid?" — invalid input stays on the form
    const validationError = validateEjUserInput(input, mode);
    if (validationError) {
      setError(validationError);
      return;
    }

    // "Apakah ada perubahan data?" — nothing changed means nothing to save
    if (
      initial &&
      name.trim() === initial.name &&
      email.trim().toLowerCase() === initial.email &&
      role === initial.role &&
      password === ""
    ) {
      onSaved("Tidak ada perubahan data");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const body = initial ? await updateUser(initial.id, input) : await createUser(input);
      if (body.ok) onSaved(`Data user ${body.data.name} berhasil tersimpan`);
      else if (body.error === UNAUTHORIZED) onUnauthorized();
      else setError(body.error);
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-label={initial ? "Edit User" : "Create User"}>
      <h2>{initial ? `Edit User — ${initial.name}` : "Create User"}</h2>
      <div className="row">
        <label>
          Nama
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as EjRole)}>
            {EJ_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          {initial ? "Password baru (kosongkan jika tidak diubah)" : "Password"}
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={submitting}>
          Simpan
        </button>
        <button type="button" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}
