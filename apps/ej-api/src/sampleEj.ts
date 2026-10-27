import { SAMPLE_ATMS, dateRange } from "@repo/shared";
import type { EjStore } from "./ejStore";
import type { MachineRepo, StoredMachine } from "./machines";

// Development data until real EJ files arrive over SFTP (ADR-0005). Not used in production.

/** Days the sample EJ files cover. */
export const SAMPLE_EJ_DATES = dateRange("2026-10-20", "2026-10-24");

/** Same seed, same numbers: sample files and tests stay stable between runs. */
function random(seed: string): () => number {
  let state = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (seconds: number) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
const rupiah = (n: number) => n.toLocaleString("id-ID");

/** One day of EJ text in the sample format that parseEj reads. */
export function sampleEjText(machine: StoredMachine, date: string, lastHour = 21): string {
  const next = random(`${machine.terminalId}|${date}`);
  const kinds = machine.type === "CRM" ? ["TARIK TUNAI", "SETOR TUNAI", "CEK SALDO", "TRANSFER"] : ["TARIK TUNAI", "CEK SALDO", "TRANSFER"];
  const failRate = machine.status === "Problem" ? 0.2 : 0.03;
  const count = 15 + Math.floor(next() * 20);
  const lines = [
    `*** ELECTRONIC JOURNAL ${machine.terminalId} ***`,
    `TANGGAL  : ${date}`,
    `LOKASI   : ${machine.location}`,
    `TIPE     : ${machine.type}`,
    "----------------------------------------",
  ];
  let t = 7 * 3600;
  const step = Math.floor(((lastHour - 7) * 3600) / count);
  for (let i = 0; i < count; i++) {
    t += 60 + Math.floor(next() * (step - 120));
    const kind = kinds[Math.floor(next() * kinds.length)];
    const rc = next() < failRate ? ["51", "55", "91"][Math.floor(next() * 3)] : "00";
    lines.push(`${clock(t)} CARD INSERTED`, `${clock(t + 12)} PIN ENTERED`, `${clock(t + 20)} TRANSACTION: ${kind}`);
    if (kind !== "CEK SALDO") lines.push(`${clock(t + 20)} AMOUNT     : ${rupiah((1 + Math.floor(next() * 20)) * 100000)}`);
    lines.push(`${clock(t + 40)} TRANSACTION END  RC=${rc}`, `${clock(t + 45)} CARD TAKEN`);
  }
  return lines.join("\n") + "\n";
}

/** Adds the sample machines when the table is empty. Returns true when it added them. */
export function seedMachines(machines: MachineRepo): boolean {
  if (machines.count() > 0) return false;
  for (const { terminalId, location, type, status } of SAMPLE_ATMS) machines.create({ terminalId, location, type, status });
  return true;
}

/**
 * Writes sample EJ files when the store has none. Offline machines stop a day early and Problem
 * machines stop mid-morning, so the ATM List shows a believable "EJ terakhir".
 */
export function seedSampleEj(store: EjStore, machines: MachineRepo): boolean {
  if (store.allDates().length > 0) return false;
  const last = SAMPLE_EJ_DATES[SAMPLE_EJ_DATES.length - 1];
  for (const machine of machines.list()) {
    for (const date of SAMPLE_EJ_DATES) {
      if (machine.status === "Offline" && date === last) continue;
      const lastHour = machine.status === "Problem" && date === last ? 11 : 21;
      store.save(machine.terminalId, date, `EJ_${machine.terminalId}_${date.replaceAll("-", "")}.jrn`, sampleEjText(machine, date, lastHour));
    }
  }
  return true;
}
