import { SampleNotice } from "./SampleNotice";

const SAMPLE_PARSED = [
  { time: "14:31:26", terminalId: "S1A0101", transaction: "Tarik tunai", amount: "500.000", rc: "00" },
  { time: "14:40:12", terminalId: "S1A0102", transaction: "Setor tunai", amount: "300.000", rc: "00" },
  { time: "11:05:48", terminalId: "S1A0215", transaction: "Tarik tunai", amount: "1.000.000", rc: "51" },
  { time: "14:52:03", terminalId: "S1A0330", transaction: "Cek saldo", amount: "-", rc: "00" },
];

/** Use case "EJ Parsing": EJ text turned into transaction rows. Placeholder with sample rows. */
export function EjParsingPage() {
  return (
    <>
      <SampleNotice>Halaman placeholder. Hasil parsing di bawah adalah data contoh.</SampleNotice>
      <section className="card">
        <h2>Hasil EJ Parsing</h2>
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
            {SAMPLE_PARSED.map((row) => (
              <tr key={`${row.terminalId}-${row.time}`}>
                <td>{row.time}</td>
                <td>{row.terminalId}</td>
                <td>{row.transaction}</td>
                <td className="num">{row.amount}</td>
                <td>{row.rc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
