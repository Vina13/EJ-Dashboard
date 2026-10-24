import { expect, test, type Page } from "@playwright/test";
import { SEED_ADMIN } from "../../ej-api/src/seed";

// TC-E2E IDs and requirements: docs/ej-dashboard/testing-strategy.md, section 4

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

/** Logs in and waits for the post-login redirect, so a following navigation isn't overridden by it. */
async function loginAsAdmin(page: Page) {
  await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
  await expect(page).toHaveURL(/#\/daily-report$/);
}
const menu = (page: Page) => page.getByRole("navigation", { name: "Menu utama" });

test("[TC-E2E-001][REQ-AUTH-002] wrong password stays on the login page with an error", async ({ page }) => {
  await login(page, SEED_ADMIN.email, "password-salah");

  await expect(page.getByRole("alert")).toHaveText("Email atau password salah");
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
});

test("[TC-E2E-002][REQ-AUTH-001][REQ-RPT-001] admin login lands on Daily Report & Performance", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page).toHaveURL(/#\/daily-report$/);
  await expect(page.getByRole("heading", { level: 1, name: "Daily Report & Performance" })).toBeVisible();
  await expect(page.getByText("Total transaksi")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Performance per mesin" })).toBeVisible();
});

test("[TC-E2E-003][REQ-HOME-001][REQ-HOME-002][REQ-MERGE-001] every menu opens and Home switches the EJ Preview", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await menu(page).getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "ATM List" })).toBeVisible();
  await page.getByRole("button", { name: "S1A0215" }).click();
  await expect(page.getByRole("heading", { name: "EJ Preview — S1A0215" })).toBeVisible();
  await expect(page.getByLabel("EJ Preview")).toContainText("S1A0215");

  await menu(page).getByRole("button", { name: "Merge EJ" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Merge EJ" })).toBeVisible();

  await menu(page).getByRole("button", { name: "User", exact: true }).click();
  await menu(page).getByRole("button", { name: "User Management" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "User Management" })).toBeVisible();

  await menu(page).getByRole("button", { name: "Daily Report & Performance" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Daily Report & Performance" })).toBeVisible();
});

test("[TC-E2E-004][REQ-USER-001][REQ-USER-002][REQ-USER-003][REQ-USER-004] create, edit and delete a user; changes survive a reload", async ({
  page,
}) => {
  // Unique per run, so a rerun against the same database still works
  const email = `vina.${Date.now()}@example.com`;
  await loginAsAdmin(page);
  await page.goto("/#/user-management");
  const row = () => page.getByRole("row").filter({ hasText: email });

  // Create User, first with a password that is too short ("Apakah Data Valid?" → Tidak)
  await page.getByRole("button", { name: "Create User" }).click();
  const create = page.getByRole("form", { name: "Create User" });
  await create.getByLabel("Nama").fill("Vina E2E");
  await create.getByLabel("Email").fill(email);
  await create.getByLabel("Password").fill("pendek");
  await create.getByRole("button", { name: "Simpan" }).click();
  await expect(create.getByRole("alert")).toHaveText("Password minimal 8 karakter");

  await create.getByLabel("Password").fill("rahasia123");
  await create.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toHaveText("Data user Vina E2E berhasil tersimpan");

  await page.reload();
  await expect(row()).toContainText("Vina E2E");

  // Edit User
  await row().getByRole("button", { name: "Edit User" }).click();
  const edit = page.getByRole("form", { name: "Edit User" });
  await edit.getByLabel("Nama").fill("Vina Agustina E2E");
  await edit.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status")).toHaveText("Data user Vina Agustina E2E berhasil tersimpan");

  await page.reload();
  await expect(row()).toContainText("Vina Agustina E2E");

  // Delete User, accepting the confirmation dialog
  page.once("dialog", (dialog) => dialog.accept());
  await row().getByRole("button", { name: "Delete User" }).click();
  await expect(page.getByRole("status")).toHaveText("Data user Vina Agustina E2E berhasil terhapus");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "User Management" })).toBeVisible();
  await expect(row()).toHaveCount(0);
});

test("[TC-E2E-005][REQ-AUTH-004][REQ-AUTH-005] after logout a menu URL shows the login page", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();

  await page.goto("/#/user-management");
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
});
