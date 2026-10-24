// Sample EJ data shared by ej-web and ej-mcp, for the menus that have no backend yet. Real EJ data will
// come from Server Sumber EJ over SFTP (FSD Gambar 3.1); replace these when that API exists.

export type MachineType = "ATM" | "CRM";
export type MachineStatus = "Online" | "Offline" | "Problem";

export interface Atm {
  terminalId: string;
  location: string;
  type: MachineType;
  status: MachineStatus;
  lastEjAt: string;
}

export const SAMPLE_ATMS: Atm[] = [
  { terminalId: "S1A0101", location: "KCP Sudirman, Jakarta", type: "ATM", status: "Online", lastEjAt: "2026-10-24 14:52" },
  { terminalId: "S1A0102", location: "Mall Grand Indonesia, Jakarta", type: "CRM", status: "Online", lastEjAt: "2026-10-24 14:49" },
  { terminalId: "S1A0215", location: "KC Bandung Asia Afrika", type: "ATM", status: "Problem", lastEjAt: "2026-10-24 11:07" },
  { terminalId: "S1A0330", location: "Bandara Juanda, Surabaya", type: "CRM", status: "Online", lastEjAt: "2026-10-24 14:55" },
  { terminalId: "S1A0418", location: "KCP Medan Merdeka", type: "ATM", status: "Offline", lastEjAt: "2026-10-23 22:31" },
];

/** A short electronic journal excerpt for the EJ Preview panel. */
export function sampleEjPreview(atm: Atm): string {
  return [
    `*** ELECTRONIC JOURNAL ${atm.terminalId} ***`,
    `LOKASI   : ${atm.location}`,
    `TIPE     : ${atm.type}`,
    "----------------------------------------",
    "14:31:05 CARD INSERTED",
    "14:31:18 PIN ENTERED",
    "14:31:26 TRANSACTION: TARIK TUNAI",
    "14:31:26 AMOUNT     : 500.000",
    "14:31:40 NOTES PRESENTED 5 x 100.000",
    "14:31:44 NOTES TAKEN",
    "14:31:47 CARD TAKEN",
    "14:31:47 TRANSACTION END  RC=00",
    ...(atm.type === "CRM"
      ? ["14:40:12 TRANSACTION: SETOR TUNAI", "14:40:30 NOTES ACCEPTED 3 x 100.000", "14:40:35 TRANSACTION END  RC=00"]
      : []),
    `${atm.lastEjAt.slice(11)}:00 LAST EJ RECORD`,
  ].join("\n");
}

export interface DailyPerformance {
  terminalId: string;
  location: string;
  transactions: number;
  failed: number;
  uptimePercent: number;
}

export const SAMPLE_DAILY_REPORT: DailyPerformance[] = [
  { terminalId: "S1A0101", location: "KCP Sudirman, Jakarta", transactions: 412, failed: 6, uptimePercent: 99.6 },
  { terminalId: "S1A0102", location: "Mall Grand Indonesia, Jakarta", transactions: 538, failed: 11, uptimePercent: 99.1 },
  { terminalId: "S1A0215", location: "KC Bandung Asia Afrika", transactions: 187, failed: 23, uptimePercent: 84.2 },
  { terminalId: "S1A0330", location: "Bandara Juanda, Surabaya", transactions: 466, failed: 4, uptimePercent: 99.8 },
  { terminalId: "S1A0418", location: "KCP Medan Merdeka", transactions: 96, failed: 2, uptimePercent: 61.5 },
];

export const SAMPLE_REPORT_DATE = "24 Oktober 2026";
