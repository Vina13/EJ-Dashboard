export const number = new Intl.NumberFormat("id-ID");
export const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** "2026-10-24" → "24 Oktober 2026". */
export function longDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** isoDate moved by `days`, still as YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Today in the browser's time zone as YYYY-MM-DD. */
export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** Saves a Blob through the browser's download prompt. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
