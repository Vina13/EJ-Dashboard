import { EJ_MENUS, EJ_ROLES, MIN_PASSWORD_LENGTH, canAccess, landingMenu, validateEjUserInput } from "./ej";

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

  it("[REQ-USER-002] accepts the three FSD roles", () => {
    for (const role of ["admin", "monitoring", "vendor"]) {
      expect(validateEjUserInput({ ...VALID, role }, "create")).toBeNull();
    }
  });

  it("[REQ-USER-002] rejects missing name, bad email and unknown role", () => {
    expect(validateEjUserInput({ ...VALID, name: "  " }, "create")).toBe("Nama wajib diisi");
    expect(validateEjUserInput({ ...VALID, email: "vina" }, "create")).toBe("Email tidak valid");
    expect(validateEjUserInput({ ...VALID, role: "root" }, "create")).toBe("Role tidak valid");
    expect(validateEjUserInput(null, "create")).toBe("Request tidak valid");
  });
});

describe("menu access", () => {
  it("[REQ-AUTH-007] matches FSD Tabel 6.1 for every role and menu", () => {
    const table = Object.fromEntries(EJ_ROLES.map((role) => [role, EJ_MENUS.filter((menu) => canAccess(role, menu))]));
    expect(table).toEqual({
      admin: ["home", "daily-report", "user-management", "merge-ej"],
      monitoring: ["home", "merge-ej"],
      vendor: ["home", "merge-ej"],
    });
  });

  it("[REQ-AUTH-001] lands admins on Daily Report and everyone else on Home", () => {
    expect(landingMenu("admin")).toBe("daily-report");
    expect(landingMenu("monitoring")).toBe("home");
    expect(landingMenu("vendor")).toBe("home");
  });
});
