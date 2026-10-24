import { PieChart } from "../PieChart";
import { SAMPLE_ATMS, SAMPLE_DAILY_REPORT, SAMPLE_REPORT_DATE } from "@repo/shared";
import { SampleNotice } from "./SampleNotice";

const number = new Intl.NumberFormat("id-ID");
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

// Checked with the dataviz palette validator: distinguishable under color-vision deficiency
const COLORS = { success: "#2a9d8f", warning: "#d99a00", fail: "#c42b1c" };

/** Landing page after login (flowchart: Menampilkan Daily Report & Performance). */
export function DailyReportPage() {
  const total = SAMPLE_DAILY_REPORT.reduce((sum, r) => sum + r.transactions, 0);
  const failed = SAMPLE_DAILY_REPORT.reduce((sum, r) => sum + r.failed, 0);
  const countStatus = (status: string) => SAMPLE_ATMS.filter((a) => a.status === status).length;
  const online = countStatus("Online");

  return (
    <>
      <SampleNotice>Data contoh. Laporan ini belum dihitung dari data EJ asli.</SampleNotice>
      <p className="muted">Laporan tanggal {SAMPLE_REPORT_DATE}</p>
      <div className="tiles">
        <Tile label="Total mesin" value={number.format(SAMPLE_ATMS.length)} accent="var(--accent)" />
        <Tile label="Mesin online" value={`${online} dari ${SAMPLE_ATMS.length}`} accent={COLORS.success} />
        <Tile label="Total transaksi" value={number.format(total)} accent="var(--accent)" />
        <Tile
          label="Tingkat sukses"
          value={total === 0 ? "–" : `${percent.format(((total - failed) / total) * 100)}%`}
          accent={COLORS.success}
        />
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
          <p className="muted card-subtitle">Kondisi mesin saat laporan dibuat.</p>
          <PieChart
            title="Status mesin"
            slices={[
              { label: "Online", value: online, color: COLORS.success },
              { label: "Problem", value: countStatus("Problem"), color: COLORS.warning },
              { label: "Offline", value: countStatus("Offline"), color: COLORS.fail },
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
              <th className="num">Uptime (%)</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_DAILY_REPORT.map((r) => (
              <tr key={r.terminalId}>
                <td>{r.terminalId}</td>
                <td>{r.location}</td>
                <td className="num">{number.format(r.transactions)}</td>
                <td className="num">{number.format(r.failed)}</td>
                <td className={`num${r.uptimePercent < 90 ? " text-critical" : ""}`}>
                  {percent.format(r.uptimePercent)}
                </td>
              </tr>
            ))}
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
