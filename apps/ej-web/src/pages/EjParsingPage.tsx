import { useCallback, useState } from "react";
import { SUCCESS_RC } from "@repo/shared";
import { getMachines, getTransactions } from "../api";
import { longDate, number } from "../format";
import { useApiData } from "../useApiData";

/** Use case "EJ Parsing": the stored EJ files turned into transaction rows. */
export function EjParsingPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [date, setDate] = useState<string | undefined>(undefined);
  const [terminalId, setTerminalId] = useState("");
  const machines = useApiData(getMachines, onUnauthorized);
  const load = useCallback(() => getTransactions(date, terminalId || undefined), [date, terminalId]);
  const { data, error, loading } = useApiData(load, onUnauthorized);
  const failed = data?.rows.filter((r) => r.rc !== SUCCESS_RC).length ?? 0;

  return (
    <>
      <div className="toolbar filters">
        <label className="inline">
          Terminal
          <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}>
            <option value="">Semua terminal</option>
            {machines.data?.map((m) => (
              <option key={m.terminalId} value={m.terminalId}>
                {m.terminalId} — {m.location}
              </option>
            ))}
          </select>
        </label>
        {data?.date && (
          <label className="inline">
            Tanggal
            <select value={data.date} disabled={loading} onChange={(e) => setDate(e.target.value)}>
              {[...new Set([...data.availableDates, data.date])].sort().reverse().map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="card">
        <h2>Hasil EJ Parsing</h2>
        {!data && !error && <p className="muted">Memuat…</p>}
        {data && data.date === null && <p className="info">Belum ada file EJ yang bisa di-parsing.</p>}
        {data?.date && (
          <>
            <p className="muted card-subtitle">
              {number.format(data.rows.length)} transaksi, {number.format(failed)} gagal (response code selain {SUCCESS_RC})
            </p>
            {data.rows.length === 0 ? (
              <p className="muted">Tidak ada transaksi pada tanggal ini.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Terminal ID</th>
                    <th>Transaksi</th>
                    <th className="num">Nominal (Rp)</th>
                    <th>Response code</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={`${row.terminalId}-${row.time}-${i}`}>
                      <td>{row.time}</td>
                      <td>{row.terminalId}</td>
                      <td>{row.transaction}</td>
                      <td className="num">{row.amount === null ? "-" : number.format(row.amount)}</td>
                      <td className={row.rc === SUCCESS_RC ? undefined : "text-critical"}>{row.rc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </>
  );
}
