import { useCallback, useState } from "react";
import type { MachineStatus } from "@repo/shared";
import { getEjPreview, getMachines } from "../api";
import { useApiData } from "../useApiData";

const STATUS_CLASS: Record<MachineStatus, string> = {
  Online: "status-good",
  Offline: "status-critical",
  Problem: "status-warning",
};

/** Flowchart Gambar 3.3: Pilih Menu Home → Menampilkan ATM List dan EJ Preview. */
export function HomePage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const machines = useApiData(getMachines, onUnauthorized);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selectedId = chosenId ?? machines.data?.[0]?.terminalId ?? null;
  const loadPreview = useCallback(() => getEjPreview(selectedId!), [selectedId]);
  const preview = useApiData(selectedId ? loadPreview : null, onUnauthorized);

  return (
    <>
      {machines.error && (
        <p role="alert" className="error">
          {machines.error}
        </p>
      )}
      <div className="split">
        <section className="card">
          <h2>ATM List</h2>
          {machines.loading && <p className="muted">Memuat…</p>}
          {machines.data?.length === 0 && <p className="muted">Belum ada mesin terdaftar.</p>}
          {machines.data && machines.data.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Terminal ID</th>
                  <th>Lokasi</th>
                  <th>Tipe</th>
                  <th>Status</th>
                  <th>EJ terakhir</th>
                </tr>
              </thead>
              <tbody>
                {machines.data.map((atm) => (
                  <tr
                    key={atm.terminalId}
                    className={`clickable${atm.terminalId === selectedId ? " selected" : ""}`}
                    onClick={() => setChosenId(atm.terminalId)}
                  >
                    <td>
                      <button className="link" onClick={() => setChosenId(atm.terminalId)}>
                        {atm.terminalId}
                      </button>
                    </td>
                    <td>{atm.location}</td>
                    <td>{atm.type}</td>
                    <td>
                      <span className={`status ${STATUS_CLASS[atm.status]}`}>{atm.status}</span>
                    </td>
                    <td>{atm.lastEjAt ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {selectedId && (
          <section className="card">
            <h2>EJ Preview — {selectedId}</h2>
            {preview.data && preview.data.terminalId === selectedId && (
              <p className="muted card-subtitle">Tanggal {preview.data.date}</p>
            )}
            {preview.loading && <p className="muted">Memuat EJ…</p>}
            {preview.error && <p className="info">{preview.error}</p>}
            {!preview.loading && preview.data && preview.data.terminalId === selectedId && (
              <pre className="ej-preview" aria-label="EJ Preview">
                {preview.data.text}
              </pre>
            )}
          </section>
        )}
      </div>
    </>
  );
}
