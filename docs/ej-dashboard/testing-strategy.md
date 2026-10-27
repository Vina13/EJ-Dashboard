# Testing Strategy: EJ Dashboard

Status: Baseline v1.0.0 (dikunci), 27 Oktober 2026 · git tag `ej-dashboard-v1.0.0` · QA owner: Vina · Requirement: [PRD.md](PRD.md) · Desain: [design.md](design.md)

Setiap requirement di PRD punya ID `REQ-<MODUL>-<NNN>`, dan setiap test menuliskan ID itu di namanya, misalnya `it("[REQ-AUTH-002] returns 401 on a wrong password …")`. Dengan begitu matriks di bagian 4 bisa dicek dengan `grep`, dan gap terlihat jelas. Prioritas memakai tier risiko P1–P4 dari PRD QA Traceability.

## 1. Lapisan test

```
            ┌───────────────────────┐
            │  E2E UI (Playwright)  │  sedikit: alur kritis di browser asli, API + DB asli
            ├───────────────────────┤
            │ Komponen (RTL, jsdom) │  menu, form, validasi UI; fetch di-mock
            ├───────────────────────┤
            │ API / integrasi       │  supertest ke Express + SQLite :memory:
            ├───────────────────────┤
            │ Unit                  │  validasi input, migrasi, tool MCP
            └───────────────────────┘
```

| Lapisan | Alat | Lokasi | Yang diuji | Jalankan |
| --- | --- | --- | --- | --- |
| Unit | Vitest | `packages/shared/src/ej.test.ts`, `ejData.test.ts` | `validateEjUserInput`, parser EJ, validasi Merge EJ dan nama file upload | `npm test -w @repo/shared` |
| API / integrasi | Vitest + supertest, SQLite `:memory:`, folder EJ sementara | `apps/ej-api/src/app.test.ts`, `ejRoutes.test.ts` | Endpoint auth, users dan menu EJ, otorisasi, kode status, migrasi | `npm test -w @repo/ej-api` |
| Unit (MCP) | Vitest + MCP SDK client | `apps/ej-mcp/src/server.test.ts` | Empat tool read-only | `npm test -w @repo/ej-mcp` |
| Komponen | Vitest + Testing Library (jsdom), fetch di-mock | `apps/ej-web/src/App.test.tsx` | Login, menu, User Management di UI | `npm test -w @repo/ej-web` |
| E2E UI | Playwright (`@playwright/test`), dijalankan ulang lewat Playwright MCP saat eksplorasi | `apps/ej-e2e/tests/` | Alur lengkap di browser dengan API dan database asli | `npm test -w @repo/ej-e2e` |

Semua test unit, API dan komponen berjalan dengan `npm test` di root. E2E dijalankan terpisah karena butuh browser dan server.

## 2. Prioritas risiko

| Tier | Requirement | Alasan | Aturan saat waktu terbatas |
| --- | --- | --- | --- |
| P1 Critical | REQ-AUTH-001, 002, 005; REQ-USER-002, 003, 004, 005; REQ-INGEST-001, REQ-PARSE-001 (saat dibuat) | Keamanan akses dan kebenaran data transaksi bank | Selalu dijalankan, di semua lapisan yang relevan |
| P2 High | REQ-AUTH-003, 004; REQ-USER-001; REQ-HOME-001, 002; REQ-RPT-001 | Fungsi utama monitoring, dihitung dari file EJ (format contoh) | Dijalankan setiap regresi |
| P3 Medium | REQ-MERGE-001, REQ-UPLOAD-001, REQ-RPT-002 | Fitur P1 di PRD | Dijalankan jika waktu cukup |
| P4 Low | Tampilan (warna, ikon, layout) | Tidak memengaruhi data | Hanya regresi penuh |

## 3. Aturan

- **Test dulu untuk fitur baru.** Untuk setiap requirement baru (mulai REQ-INGEST-001 dan REQ-PARSE-001), tulis test yang gagal lebih dulu, lalu kodenya. Fitur yang sudah ada diberi test setelahnya (lihat gap di bagian 5).
- **Satu ID per test, minimal satu test per requirement P1/P2.** Test yang mencakup dua requirement menulis keduanya: `[REQ-AUTH-004][REQ-AUTH-005]`. Test untuk keputusan desain, bukan requirement, memakai ID ADR, misalnya `[ADR-0006]`.
- **Database test selalu `:memory:`** dan dibuat baru per test, jadi test tidak saling memengaruhi dan tidak menyentuh `data/ej-dashboard.db`.
- **Waktu dikendalikan test** (`now` bisa diinjeksi ke `createApp`) untuk expiry session dan rate limit, tanpa `sleep`.
- **E2E memakai database sendiri** (`EJ_DB_PATH` ke folder sementara) dan akun admin seed, tidak memakai database pengembangan.
- **Parsing EJ (nanti):** test memakai file EJ contoh asli dari vendor di `apps/ej-api/test/fixtures/`, termasuk file rusak dan file yang sama diunggah dua kali (idempotensi).
- **Exit criteria fase Testing (SDLC):** semua test P1 dan P2 lulus, `npm run typecheck` lulus, tidak ada defect P1 terbuka.

## 4. Traceability matrix

| Requirement | Tier | Unit / API | Komponen (ej-web) | E2E UI |
| --- | --- | --- | --- | --- |
| REQ-AUTH-001 Login | P1 | ej-api: logs in the seeded admin; creates the admin only when the table is empty | lands on Daily Report & Performance after a successful login | TC-E2E-002 |
| REQ-AUTH-002 Login gagal tetap di login | P1 | ej-api: returns 401 on a wrong password; gives the same answer for an unknown email | stays on the login page with an error | TC-E2E-001 |
| REQ-AUTH-003 Rate limit login | P2 | ej-api: blocks login after 5 failures | — | — |
| REQ-AUTH-004 Logout dan expiry | P2 | ej-api: GET /api/auth/me needs a session, and logout ends it; session expires after 1 hour | returns to the login page after logout | TC-E2E-005 |
| REQ-AUTH-005 Semua butuh login | P1 | ej-api: requires login to list users; GET /api/auth/me needs a session; a password change ends that user's existing sessions | returns to the login page when the session expired before saving | TC-E2E-005 |
| REQ-USER-001 Daftar user | P2 | ej-api: creates a user that can then log in (list) | creates a user and shows it in the list | TC-E2E-004 |
| REQ-USER-002 Create User | P1 | ej-api: creates a user…; rejects invalid input and duplicate emails. shared: validateEjUserInput | validates Create User input…; creates a user… | TC-E2E-004 |
| REQ-USER-003 Edit User | P1 | ej-api: edits a user…; changes the password…; does not let an admin demote their own account; db: renames the old operator role to monitoring. shared: requires a password on create but not on edit | does not call the API when an edit changes nothing | TC-E2E-004 |
| REQ-USER-004 Delete User | P1 | ej-api: deletes a user, but not the account that is logged in; returns 404… | deletes a user after confirmation | TC-E2E-004 |
| REQ-USER-005 Hanya admin mengubah user | P1 | ej-api: lets monitoring users view users but not change them | hides the change buttons from monitoring users | — |
| REQ-HOME-001 ATM List | P2 | ej-api: lists machines with the time of their last EJ record; shows null when a machine has no EJ yet. shared: finds the time of the last record. ej-mcp: filters machines by status | lists machines and previews the EJ of the first one | TC-E2E-003 |
| REQ-HOME-002 EJ Preview | P2 | ej-api: returns the latest EJ of a machine, or of a chosen day; answers 404/400. ej-mcp: returns the EJ preview for a machine | lists machines and previews…; explains when a machine has no EJ yet | TC-E2E-003, TC-E2E-006 |
| REQ-RPT-001 Daily Report | P2 | ej-api: counts transactions and failures from the parsed EJ of the latest day; reports no date when no EJ file exists yet | lands on Daily Report & Performance…; shows the Daily Report counted by the server | TC-E2E-002, TC-E2E-006 |
| REQ-RPT-002 Pilih tanggal | P3 | ej-api: shows another day when a date is given | loads another day when a date is chosen | — |
| REQ-MERGE-001 Merge EJ | P3 | ej-api: joins the EJ files of the range into one download; rejects invalid input…; is open to monitoring users. shared: validasi rentang | downloads the merged EJ file; checks the date range before calling the API | TC-E2E-003, TC-E2E-007 |
| REQ-UPLOAD-001 Upload EJ | P3 | ej-api: stores the file so every EJ menu sees it; never overwrites; rejects unsafe names…; is only for admins. shared: nama file | — | — |
| REQ-PARSE-001 EJ Parsing | P1 | shared: turns EJ lines into transactions… (format contoh). ej-api: returns parsed transactions…; filters by terminal | — | — |
| REQ-INGEST-001 SFTP | P1 | — | — | — |

### Test E2E (Playwright)

| ID | Skenario | Requirement |
| --- | --- | --- |
| TC-E2E-001 | Password salah: tetap di login, pesan "Email atau password salah" | REQ-AUTH-002 |
| TC-E2E-002 | Login admin: masuk ke Daily Report & Performance, tile dan tabel tampil | REQ-AUTH-001, REQ-RPT-001 |
| TC-E2E-003 | Semua menu terbuka, termasuk EJ Parsing dan Upload EJ Parsing → Upload EJ; pilih mesin di Home mengganti EJ Preview | REQ-HOME-001, 002, REQ-MERGE-001, REQ-PARSE-001, REQ-UPLOAD-001 |
| TC-E2E-004 | Create → reload → Edit → reload → Delete user; data bertahan di database | REQ-USER-001..004 |
| TC-E2E-005 | Logout, lalu buka URL menu langsung: kembali ke login | REQ-AUTH-004, 005 |
| TC-E2E-006 | Menu EJ menampilkan data dari server (file EJ contoh) | REQ-HOME-002, REQ-RPT-001 |
| TC-E2E-007 | Merge EJ mengunduh satu file berisi setiap hari dalam rentang | REQ-MERGE-001 |

## 5. Gap

| Gap | Tier | Tindakan |
| --- | --- | --- |
| REQ-INGEST-001 belum ada kode maupun test | P1 | Tunggu akses SFTP; tulis test dulu (bagian 3) |
| REQ-PARSE-001 diuji dengan format EJ contoh, bukan file vendor | P1 | Ganti fixture dengan file EJ asli vendor saat tersedia |
| Halaman EJ Parsing dan Upload EJ belum punya test komponen maupun E2E | P3 | Tambahkan test unggah file di UI dan tabel hasil parsing |
| MCP server masih memakai data contoh dari `packages/shared` ([ADR-0006](adr/0006-read-only-mcp-server.md)) | P3 | Arahkan tool MCP ke file EJ yang sama dengan `ej-api` |
| Belum ada test aksesibilitas dan tampilan mobile | P4 | Tambahkan pemeriksaan Playwright di lebar 375 px |
