import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isIsoDate, isTerminalId, validateEjFileName } from "@repo/shared";

/** apps/ej-api/data/ej, wherever the process is started from. */
export const DEFAULT_EJ_DIR = fileURLToPath(new URL("../data/ej", import.meta.url));

export interface EjFile {
  name: string;
  content: string;
}

export class EjFileExistsError extends Error {}

function listDirs(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Raw EJ files on disk, one folder per terminal and day: <root>/<terminalId>/<YYYY-MM-DD>/<file>.
 * SFTP ingest (ADR-0005) and Upload EJ both write here; every EJ menu reads from here.
 * Callers pass validated terminal IDs and dates; they are checked again so no path can leave the root.
 */
export function createEjStore(root: string) {
  function dayDir(terminalId: string, date: string): string {
    if (!isTerminalId(terminalId) || !isIsoDate(date)) throw new Error(`Invalid EJ location ${terminalId}/${date}`);
    return join(root, terminalId, date);
  }

  return {
    /** Days that have EJ files for this terminal, oldest first. */
    dates(terminalId: string): string[] {
      if (!isTerminalId(terminalId)) return [];
      return listDirs(join(root, terminalId)).filter(isIsoDate).sort();
    },

    /** Days that have EJ files for any terminal, oldest first. */
    allDates(): string[] {
      const dates = new Set(listDirs(root).flatMap((terminalId) => this.dates(terminalId)));
      return [...dates].sort();
    },

    /** The files of one terminal and day, sorted by name. */
    read(terminalId: string, date: string): EjFile[] {
      const dir = dayDir(terminalId, date);
      if (!existsSync(dir)) return [];
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
        .map((name) => ({ name, content: readFileSync(join(dir, name), "utf8") }));
    },

    /** Stores a new file; never overwrites, so a re-sent file can't silently replace evidence. */
    save(terminalId: string, date: string, name: string, content: Buffer | string): void {
      const dir = dayDir(terminalId, date);
      if (validateEjFileName(name)) throw new Error(`Invalid EJ file name ${name}`);
      mkdirSync(dir, { recursive: true });
      try {
        writeFileSync(join(dir, name), content, { flag: "wx" });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new EjFileExistsError(name);
        throw err;
      }
    },
  };
}

export type EjStore = ReturnType<typeof createEjStore>;
