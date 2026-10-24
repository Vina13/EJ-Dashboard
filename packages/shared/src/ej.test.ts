import { MIN_PASSWORD_LENGTH, validateEjUserInput } from "./ej";

const VALID = { name: "Vina", email: "vina@example.com", role: "monitoring", password: "rahasia123" };

describe("validateEjUserInput", () => {
  it("[REQ-USER-002] accepts a valid new user", () => {
    expect(validateEjUserInput(VALID, "create")).toBeNull();
  });

  it("[REQ-USER-002][REQ-USER-003] requires a password on create but not on edit", () => {
    const { password: _, ...noPassword } = VALID;
    expect(validateEjUserInput(noPassword, "create")).toBe("Password wajib diisi");
    expect(validateEjUserInput(noPassword, "edit")).toBeNull();
    expect(validateEjUserInput({ ...noPassword, password: "" }, "edit")).toBeNull();
  });

  it("[REQ-USER-002] rejects a short password", () => {
    expect(validateEjUserInput({ ...VALID, password: "x".repeat(MIN_PASSWORD_LENGTH - 1) }, "create")).toBe(
      `Password minimal ${MIN_PASSWORD_LENGTH} karakter`,
    );
  });

  it("[REQ-USER-002] rejects missing name, bad email and unknown role", () => {
    expect(validateEjUserInput({ ...VALID, name: "  " }, "create")).toBe("Nama wajib diisi");
    expect(validateEjUserInput({ ...VALID, email: "vina" }, "create")).toBe("Email tidak valid");
    expect(validateEjUserInput({ ...VALID, role: "root" }, "create")).toBe("Role tidak valid");
    expect(validateEjUserInput(null, "create")).toBe("Request tidak valid");
  });
});
