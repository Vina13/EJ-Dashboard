import { useState, type FormEvent } from "react";
import { MAX_MERGE_DAYS, validateMergeInput } from "@repo/shared";
import { UNAUTHORIZED, getMachines, mergeEj } from "../api";
import { addDays, saveFile } from "../format";
import { useApiData } from "../useApiData";

/** Use case "Merge EJ": the EJ files of one machine over a date range, downloaded as one text file. */
export function MergeEjPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const machines = useApiData(getMachines, onUnauthorized);
  // Null until the user picks something; the defaults follow the first machine's last EJ day
  const [picked, setPicked] = useState<{ terminalId?: string; from?: string; to?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const first = machines.data?.[0];
  const lastDay = first?.lastEjAt?.slice(0, 10);
  const terminalId = picked.terminalId ?? first?.terminalId ?? "";
  const to = picked.to ?? lastDay ?? "";
  const from = picked.from ?? (lastDay ? addDays(lastDay, -4) : "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const input = { terminalId, from, to };
    const invalid = validateMergeInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const body = await mergeEj(input);
      if (!body.ok) {
        if (body.error === UNAUTHORIZED) onUnauthorized();
        else setError(body.error);
        return;
      }
      saveFile(body.data.blob, body.data.fileName);
      setMessage(`File ${body.data.fileName} berhasil dibuat dan diunduh`);
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {machines.error && (
        <p role="alert" className="error">
          {machines.error}
        </p>
      )}
      <form className="card form" aria-label="Merge EJ" onSubmit={handleSubmit}>
        <label>
          Terminal
          <select
            name="terminal"
            value={terminalId}
            disabled={!machines.data}
            onChange={(e) => setPicked({ ...picked, terminalId: e.target.value })}
          >
            {machines.data?.map((a) => (
              <option key={a.terminalId} value={a.terminalId}>
                {a.terminalId} — {a.location}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <label>
            Dari tanggal
            <input type="date" name="from" value={from} onChange={(e) => setPicked({ ...picked, from: e.target.value })} />
          </label>
          <label>
            Sampai tanggal
            <input type="date" name="to" value={to} onChange={(e) => setPicked({ ...picked, to: e.target.value })} />
          </label>
        </div>
        <p className="muted">Maksimal {MAX_MERGE_DAYS} hari. Hasilnya satu file teks berisi semua EJ pada rentang itu.</p>
        <button type="submit" className="primary" disabled={busy || !terminalId}>
          {busy ? "Memproses…" : "Merge EJ"}
        </button>
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
