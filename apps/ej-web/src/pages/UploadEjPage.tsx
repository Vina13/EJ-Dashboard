import { useState, type FormEvent } from "react";
import { EJ_FILE_EXTENSIONS, MAX_EJ_FILE_BYTES, validateEjFileName, type EjUser } from "@repo/shared";
import { UNAUTHORIZED, getMachines, uploadEj } from "../api";
import { number, today } from "../format";
import { useApiData } from "../useApiData";

interface UploadEjPageProps {
  currentUser: EjUser;
  onUnauthorized: () => void;
}

/** Use case "Upload EJ" (extends Upload EJ Parsing): an EJ file that missed SFTP, stored like any other. */
export function UploadEjPage({ currentUser, onUnauthorized }: UploadEjPageProps) {
  const isAdmin = currentUser.role === "admin";
  const machines = useApiData(getMachines, onUnauthorized);
  const [pickedTerminal, setPickedTerminal] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  // A new key empties the file input after a successful upload
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const terminalId = pickedTerminal ?? machines.data?.[0]?.terminalId ?? "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!file) {
      setError("Pilih file EJ terlebih dahulu.");
      return;
    }
    const invalid = validateEjFileName(file.name);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (file.size > MAX_EJ_FILE_BYTES) {
      setError(`File maksimal ${MAX_EJ_FILE_BYTES / 1024 / 1024} MB`);
      return;
    }
    setBusy(true);
    try {
      const body = await uploadEj(file, terminalId, date);
      if (!body.ok) {
        if (body.error === UNAUTHORIZED) onUnauthorized();
        else setError(body.error);
        return;
      }
      const r = body.data;
      setMessage(
        `File ${r.fileName} tersimpan untuk ${r.terminalId} tanggal ${r.date}: ${number.format(r.transactions)} transaksi terbaca.`,
      );
      setFile(null);
      setFileKey((k) => k + 1);
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!isAdmin && <p className="notice">Hanya admin yang dapat mengunggah file EJ.</p>}
      {machines.error && (
        <p role="alert" className="error">
          {machines.error}
        </p>
      )}
      <form className="card form" aria-label="Upload EJ" onSubmit={handleSubmit}>
        <fieldset disabled={!isAdmin || busy}>
          <div className="row">
            <label>
              Terminal
              <select value={terminalId} onChange={(e) => setPickedTerminal(e.target.value)}>
                {machines.data?.map((m) => (
                  <option key={m.terminalId} value={m.terminalId}>
                    {m.terminalId} — {m.location}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tanggal EJ
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label>
            File EJ ({EJ_FILE_EXTENSIONS.join(" / ")})
            <input
              key={fileKey}
              type="file"
              accept={EJ_FILE_EXTENSIONS.join(",")}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setMessage(null);
                setError(null);
              }}
            />
          </label>
          <button type="submit" className="primary" disabled={!terminalId}>
            {busy ? "Mengunggah…" : "Upload EJ"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
