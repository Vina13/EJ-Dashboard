import { useState } from "react";
import { SAMPLE_ATMS, sampleEjPreview, type MachineStatus } from "@repo/shared";
import { SampleNotice } from "./SampleNotice";

const STATUS_CLASS: Record<MachineStatus, string> = {
  Online: "status-good",
  Offline: "status-critical",
  Problem: "status-warning",
};

/** Flowchart Gambar 3.3: Pilih Menu Home → Menampilkan ATM List dan EJ Preview. */
export function HomePage() {
  const [selectedId, setSelectedId] = useState(SAMPLE_ATMS[0].terminalId);
  const selected = SAMPLE_ATMS.find((a) => a.terminalId === selectedId)!;

  return (
    <>
      <SampleNotice>Data contoh. ATM List dan EJ Preview belum terhubung ke data EJ dari Server Sumber EJ.</SampleNotice>
      <div className="split">
        <section className="card">
          <h2>ATM List</h2>
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
              {SAMPLE_ATMS.map((atm) => (
                <tr
                  key={atm.terminalId}
                  className={`clickable${atm.terminalId === selectedId ? " selected" : ""}`}
                  onClick={() => setSelectedId(atm.terminalId)}
                >
                  <td>
                    <button className="link" onClick={() => setSelectedId(atm.terminalId)}>
                      {atm.terminalId}
                    </button>
                  </td>
                  <td>{atm.location}</td>
                  <td>{atm.type}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[atm.status]}`}>{atm.status}</span>
                  </td>
                  <td>{atm.lastEjAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>EJ Preview — {selected.terminalId}</h2>
          <pre className="ej-preview" aria-label="EJ Preview">
            {sampleEjPreview(selected)}
          </pre>
        </section>
      </div>
    </>
  );
}
