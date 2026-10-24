import { useState, type FormEvent } from "react";
import { SAMPLE_ATMS } from "@repo/shared";
import { SampleNotice } from "./SampleNotice";

/** Use case "Merge EJ": combine EJ files of one machine over a date range. Placeholder only. */
export function MergeEjPage() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(`Simulasi: EJ ${form.get("terminal")} dari ${form.get("from")} sampai ${form.get("to")} belum digabung (belum ada backend).`);
  }

  return (
    <>
      <SampleNotice>Halaman placeholder. Proses Merge EJ belum terhubung ke server.</SampleNotice>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Terminal
          <select name="terminal" defaultValue={SAMPLE_ATMS[0].terminalId}>
            {SAMPLE_ATMS.map((a) => (
              <option key={a.terminalId} value={a.terminalId}>
                {a.terminalId} — {a.location}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <label>
            Dari tanggal
            <input type="date" name="from" defaultValue="2026-10-20" />
          </label>
          <label>
            Sampai tanggal
            <input type="date" name="to" defaultValue="2026-10-24" />
          </label>
        </div>
        <button type="submit" className="primary">
          Merge EJ
        </button>
        {message && <p role="status" className="info">{message}</p>}
      </form>
    </>
  );
}
