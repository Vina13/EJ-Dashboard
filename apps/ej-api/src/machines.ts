import type { DatabaseSync } from "node:sqlite";
import type { MachineStatus, MachineType } from "@repo/shared";

export interface StoredMachine {
  terminalId: string;
  location: string;
  type: MachineType;
  status: MachineStatus;
}

const COLUMNS = "terminal_id AS terminalId, location, type, status";

export function createMachineRepo(db: DatabaseSync) {
  return {
    list(): StoredMachine[] {
      return db.prepare(`SELECT ${COLUMNS} FROM machines ORDER BY terminal_id`).all() as unknown as StoredMachine[];
    },
    find(terminalId: string): StoredMachine | undefined {
      return db.prepare(`SELECT ${COLUMNS} FROM machines WHERE terminal_id = ?`).get(terminalId) as
        | StoredMachine
        | undefined;
    },
    count(): number {
      return (db.prepare("SELECT COUNT(*) AS n FROM machines").get() as { n: number }).n;
    },
    create(machine: StoredMachine): void {
      db.prepare("INSERT INTO machines (terminal_id, location, type, status) VALUES (?, ?, ?, ?)").run(
        machine.terminalId,
        machine.location,
        machine.type,
        machine.status,
      );
    },
  };
}

export type MachineRepo = ReturnType<typeof createMachineRepo>;
