import { dateRange, isIsoDate, lastRecordTime, parseEj, validateEjFileName, validateMergeInput } from "./ejData";

const EJ = [
  "*** ELECTRONIC JOURNAL S1A0101 ***",
  "08:01:05 CARD INSERTED",
  "08:01:26 TRANSACTION: TARIK TUNAI",
  "08:01:26 AMOUNT     : 1.500.000",
  "08:01:47 TRANSACTION END  RC=00",
  "08:05:10 TRANSACTION: CEK SALDO",
  "08:05:15 TRANSACTION END  RC=55",
  "08:09:00 TRANSACTION: TRANSFER",
  "08:09:30 CARD TAKEN",
].join("\r\n");

describe("parseEj", () => {
  it("[REQ-PARSE-001] turns EJ lines into transactions and skips unfinished ones", () => {
    expect(parseEj(EJ, "S1A0101", "2026-10-24")).toEqual([
      { date: "2026-10-24", time: "08:01:26", terminalId: "S1A0101", transaction: "Tarik Tunai", amount: 1500000, rc: "00" },
      { date: "2026-10-24", time: "08:05:10", terminalId: "S1A0101", transaction: "Cek Saldo", amount: null, rc: "55" },
    ]);
  });

  it("[REQ-HOME-001] finds the time of the last record", () => {
    expect(lastRecordTime(EJ)).toBe("08:09");
    expect(lastRecordTime("no records")).toBeNull();
  });
});

describe("validateMergeInput", () => {
  const VALID = { terminalId: "S1A0101", from: "2026-10-20", to: "2026-10-24" };

  it("[REQ-MERGE-001] accepts a valid range, including a single day", () => {
    expect(validateMergeInput(VALID)).toBeNull();
    expect(validateMergeInput({ ...VALID, from: "2026-10-24" })).toBeNull();
  });

  it("[REQ-MERGE-001] rejects bad terminals, dates and ranges", () => {
    expect(validateMergeInput({ ...VALID, terminalId: "../etc" })).toBe("Terminal tidak valid");
    expect(validateMergeInput({ ...VALID, from: "2026-02-30" })).toBe("Tanggal awal tidak valid");
    expect(validateMergeInput({ ...VALID, from: "2026-10-25" })).toMatch(/^Tanggal awal harus/);
    expect(validateMergeInput({ ...VALID, from: "2026-09-01" })).toBe("Rentang tanggal maksimal 31 hari");
    expect(validateMergeInput(null)).toBe("Request tidak valid");
  });
});

describe("dates", () => {
  it("lists every day of a range and checks real calendar dates", () => {
    expect(dateRange("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(isIsoDate("2026-10-24")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("24-10-2026")).toBe(false);
  });
});

describe("validateEjFileName", () => {
  it("[REQ-UPLOAD-001] accepts EJ files and rejects paths and other extensions", () => {
    expect(validateEjFileName("EJ_S1A0101_20261024.jrn")).toBeNull();
    expect(validateEjFileName("journal.TXT")).toBeNull();
    expect(validateEjFileName("../secret.txt")).toMatch(/^Nama file/);
    expect(validateEjFileName("report.pdf")).toBe("File harus berformat .txt / .jrn / .log");
  });
});
