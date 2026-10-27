import { useCallback, useState } from "react";
import { getDailyReport } from "../api";
import { longDate, number, percent } from "../format";
import { PieChart } from "../PieChart";
import { useApiData } from "../useApiData";

// Checked with the dataviz palette validator: distinguishable under color-vision deficiency
const COLORS = { success: "#2a9d8f", warning: "#d99a00", fail: "#c42b1c" };

/** Below this success rate a machine is highlighted in the performance table. */
const LOW_SUCCESS_PERCENT = 90;

const successRate = (transactions: number, failed: number) =>
  transactions === 0 ? null : ((transactions - failed) / transactions) * 100;

/** Landing page after login (flowchart: Menampilkan Daily Report & Performance), counted from the parsed EJ. */
export function DailyReportPage({ onUnauthorized }: { onUnauthorized: () => void }) {
  // Undefined: the latest day that has EJ files
  const [date, setDate] = useState<string | undefined>(undefined);
  const load = useCallback(() => getDailyReport(date), [date]);
  const { data: report, error, loading } = useApiData(load, onUnauthorized);

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  }
  if (!report) return <p className="muted">Memuat…</p>;

  const total = report.rows.reduce((sum, r) => sum + r.transactions, 0);
  const failed = report.rows.reduce((sum, r) => sum + r.failed, 0);
  const rate = successRate(total, failed);
  const { machines } = report;

  return (
    <>
      <div className="toolbar">
        {report.date ? (
          <label className="inline">
            Tanggal laporan
            <select value={report.date} disabled={loading} onChange={(e) => setDate(e.target.value)}>
              {/* Newest first; a typed-in date without files is still shown */}
              {[...new Set([...report.availableDates, report.date])].sort().reverse().map((d) => (
                <option key={d} value={d}>
                  {longDate(d)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="info">Belum ada file EJ yang masuk, jadi belum ada transaksi untuk dilaporkan.</p>
        )}
      </div>
      <div className="tiles">
        <Tile label="Total mesin" value={number.format(machines.total)} accent="var(--accent)" />
        <Tile label="Mesin online" value={`${machines.online} dari ${machines.total}`} accent={COLORS.success} />
        <Tile label="Total transaksi" value={number.format(total)} accent="var(--accent)" />
        <Tile label="Tingkat sukses" value={rate === null ? "–" : `${percent.format(rate)}%`} accent={COLORS.success} />
      </div>
      <div className="split">
        <section className="card">
          <h2>Transaksi</h2>
          <p className="muted card-subtitle">Sukses dan gagal dari semua mesin.</p>
          <PieChart
            title="Transaksi sukses dan gagal"
            slices={[
              { label: "Sukses", value: total - failed, color: COLORS.success },
              { label: "Gagal", value: failed, color: COLORS.fail },
            ]}
          />
        </section>
        <section className="card">
          <h2>Status mesin</h2>
          <p className="muted card-subtitle">Kondisi mesin saat ini.</p>
          <PieChart
            title="Status mesin"
            slices={[
              { label: "Online", value: machines.online, color: COLORS.success },
              { label: "Problem", value: machines.problem, color: COLORS.warning },
              { label: "Offline", value: machines.offline, color: COLORS.fail },
            ]}
          />
        </section>
      </div>
      <section className="card">
        <h2>Performance per mesin</h2>
        <table>
          <thead>
            <tr>
              <th>Terminal ID</th>
              <th>Lokasi</th>
              <th className="num">Transaksi</th>
              <th className="num">Gagal</th>
              <th className="num">Sukses (%)</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => {
              const machineRate = successRate(r.transactions, r.failed);
              return (
                <tr key={r.terminalId}>
                  <td>{r.terminalId}</td>
                  <td>{r.location}</td>
                  <td className="num">{number.format(r.transactions)}</td>
                  <td className="num">{number.format(r.failed)}</td>
                  <td className={`num${machineRate !== null && machineRate < LOW_SUCCESS_PERCENT ? " text-critical" : ""}`}>
                    {machineRate === null ? "–" : percent.format(machineRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="tile" style={{ borderLeftColor: accent }}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
    </div>
  );
}
