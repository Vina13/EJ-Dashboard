import {
  MAX_PASSWORD_LENGTH,
  failure,
  isUser,
  normalizeEmail,
  success,
  validateLoginInput,
} from "./index";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });
});

describe("validateLoginInput", () => {
  it("accepts a valid login", () => {
    expect(validateLoginInput({ email: "ana@example.com", password: "x" })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(validateLoginInput(undefined)).toBe("Request tidak valid");
  });

  it("rejects an invalid or missing email", () => {
    expect(validateLoginInput({ email: "ana", password: "x" })).toBe("Email tidak valid");
    expect(validateLoginInput({ password: "x" })).toBe("Email tidak valid");
  });

  it("rejects an empty or too long password", () => {
    expect(validateLoginInput({ email: "ana@example.com", password: "" })).toBe(
      "Password wajib diisi",
    );
    expect(
      validateLoginInput({
        email: "ana@example.com",
        password: "a".repeat(MAX_PASSWORD_LENGTH + 1),
      }),
    ).toBe("Password terlalu panjang");
  });
});

describe("ApiResponse helpers", () => {
  it("wraps data in a success response", () => {
    expect(success({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
  });

  it("wraps an error message in a failure response", () => {
    expect(failure("boom")).toEqual({ ok: false, error: "boom" });
  });
});

describe("isUser", () => {
  it("accepts a valid user", () => {
    expect(isUser({ id: 1, name: "Ana", email: "ana@example.com" })).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isUser(null)).toBe(false);
    expect(isUser({ id: "1", name: "Ana", email: "ana@example.com" })).toBe(false);
    expect(isUser({ id: 1, name: "Ana" })).toBe(false);
  });
});
