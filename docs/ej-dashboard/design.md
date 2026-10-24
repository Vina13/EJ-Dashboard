# System Design: EJ Dashboard

Status: Draft v1, 24 Oktober 2026 · Requirement: [PRD.md](PRD.md) · Keputusan: [adr/](adr/)

Dokumen ini menjelaskan dua hal: **apa yang sudah dibangun** di repo ini (login, User Management, menu dengan data contoh) dan **desain target** untuk bagian yang belum ada (ambil EJ via SFTP dan EJ Parsing), sesuai FSD Gambar 3.1.

## 1. Requirements ringkas

**Fungsional** (detail di PRD): login dan logout, User Management (admin), ATM List + EJ Preview, Daily Report & Performance, Merge EJ, EJ Parsing, Upload EJ.

**Non-fungsional**

| Aspek | Target | Catatan |
| --- | --- | --- |
| Pengguna bersamaan | ≤ 50 | Asumsi: tim monitoring satu bank |
| Jumlah mesin | ≤ 2.000 ATM/CRM | Asumsi, perlu dikonfirmasi klien |
| Volume EJ | ≤ 2.000 file/hari, ≤ 5 MB per file | Asumsi, menunggu contoh file asli |
| Keterlambatan data | ≤ 15 menit dari file masuk ke dashboard | PRD goal 2 |
| EJ Preview | ≤ 3 detik (p95) | PRD goal 3 |
| Ketersediaan | Jam kerja, satu server | Tidak perlu high availability di v1 |
| Lokasi data | On-premise di Server EJ Dashboard | Data transaksi bank tidak keluar ke cloud ([ADR-0001](adr/0001-sqlite-on-premise.md)) |

**Batasan:** tim kecil (QA + developer), stack TypeScript yang sudah ada di monorepo, database SQLite lokal (keputusan user), repository resmi dari developer belum tersedia.

## 2. Arsitektur

```
 ┌──────────────────────┐      SFTP :22      ┌──────────┐      SFTP :22      ┌──────────────────────────────────────────────┐
 │ Server Sumber EJ      │ ◀───────────────── │ FIREWALL │ ◀───────────────── │ Server EJ Dashboard                          │
 │ Source EJ ATM & CRM   │   file EJ (.jrn)   └──────────┘   (pull terjadwal)  │                                              │
 └──────────────────────┘                                                     │  ej-ingest (target) ──▶ ej-parse (target)    │
                                                                              │        │ file mentah          │ transaksi    │
                                                                              │        ▼                      ▼              │
                                                                              │  data/ej/<terminal>/<tgl>   SQLite            │
                                                                              │                     ej-dashboard.db          │
                                                                              │                       ▲          ▲  read-only │
                                                                              │   ej-api (Express) ───┘          └── ej-mcp   │
                                                                              │        ▲ /api (cookie session)                │
                                                                              │   ej-web (React, Vite)                       │
                                                                              └───────────────▲──────────────────────────────┘
                                                                                              │ HTTPS
                                                                                     Browser petugas / admin
```

Arah tarikan: Server EJ Dashboard yang **menarik** file dari Sumber EJ ([ADR-0005](adr/0005-sftp-pull-ingestion.md)). Firewall cukup membuka port 22 dari Server EJ Dashboard ke Sumber EJ.

### Komponen

| Komponen | Lokasi | Tanggung jawab | Status |
| --- | --- | --- | --- |
| `ej-web` | `apps/ej-web` | UI React: login, menu, halaman. Memanggil `/api` lewat proxy (same-origin) | Ada |
| `ej-api` | `apps/ej-api` | REST API, autentikasi, User Management, akses SQLite | Ada (users saja) |
| `ej-mcp` | `apps/ej-mcp` | MCP server read-only agar Claude bisa membaca user, mesin, laporan, EJ preview ([ADR-0006](adr/0006-read-only-mcp-server.md)) | Ada |
| `shared` | `packages/shared` | Tipe, validasi input, data contoh EJ yang dipakai web, api dan mcp | Ada |
| `ej-ingest` | belum ada | Job terjadwal: tarik file EJ baru via SFTP, simpan file mentah | Target |
| `ej-parse` | belum ada | Ubah file EJ menjadi baris transaksi dan status mesin | Target |

## 3. Data model

### Sudah ada

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,          -- disimpan lowercase
  role          TEXT NOT NULL CHECK (role IN ('admin', 'monitoring')),
  password_hash TEXT NOT NULL,                 -- scrypt "salt:hash"
  created_at    TEXT NOT NULL,                 -- ISO 8601 UTC
  updated_at    TEXT NOT NULL
);
```

Skema dibuat dan dimigrasi saat `ej-api` start (`apps/ej-api/src/db.ts`). Contoh: role `operator` lama dimigrasi otomatis menjadi `monitoring`.

### Target (untuk REQ-INGEST, REQ-PARSE, REQ-HOME, REQ-RPT)

```sql
CREATE TABLE machines (
  terminal_id  TEXT PRIMARY KEY,               -- mis. S1A0101
  location     TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('ATM', 'CRM')),
  last_ej_at   TEXT                            -- waktu record EJ terakhir
);

CREATE TABLE ej_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id  TEXT NOT NULL REFERENCES machines(terminal_id),
  ej_date      TEXT NOT NULL,                  -- YYYY-MM-DD
  path         TEXT NOT NULL,                  -- data/ej/<terminal>/<tgl>/<nama file>
  sha256       TEXT NOT NULL UNIQUE,           -- file sama tidak diproses dua kali
  source       TEXT NOT NULL CHECK (source IN ('sftp', 'upload')),
  status       TEXT NOT NULL CHECK (status IN ('received', 'parsed', 'failed')),
  error        TEXT,
  received_at  TEXT NOT NULL
);

CREATE TABLE ej_transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ej_file_id   INTEGER NOT NULL REFERENCES ej_files(id) ON DELETE CASCADE,
  terminal_id  TEXT NOT NULL,
  occurred_at  TEXT NOT NULL,
  kind         TEXT NOT NULL,                  -- tarik tunai, setor tunai, cek saldo, ...
  amount       INTEGER,                        -- rupiah, NULL jika tidak ada nominal
  response_code TEXT NOT NULL                  -- '00' = sukses
);
CREATE INDEX ej_transactions_by_terminal_time ON ej_transactions (terminal_id, occurred_at);
```

Status mesin (Online/Offline/Problem) **dihitung**, tidak disimpan: Offline jika `last_ej_at` lebih tua dari ambang waktu, Problem jika rasio gagal di atas ambang. Ambang menunggu definisi bisnis (PRD open question).

## 4. API

Semua respons memakai bentuk `{ ok: true, data } | { ok: false, error }` dari `@repo/shared`.

| Method | Path | Auth | Fungsi | Requirement | Status |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | — | Login, set cookie `ej_session` | REQ-AUTH-001..003 | Ada |
| POST | `/api/auth/logout` | — | Hapus cookie | REQ-AUTH-004 | Ada |
| GET | `/api/auth/me` | login | User saat ini | REQ-AUTH-005 | Ada |
| GET | `/api/users` | login | Daftar user | REQ-USER-001 | Ada |
| GET | `/api/users/:id` | login | Satu user | REQ-USER-001 | Ada |
| POST | `/api/users` | admin | Create User | REQ-USER-002 | Ada |
| PUT | `/api/users/:id` | admin | Edit User | REQ-USER-003 | Ada |
| DELETE | `/api/users/:id` | admin | Delete User | REQ-USER-004 | Ada |
| GET | `/api/machines` | login | ATM List dengan status | REQ-HOME-001 | Target |
| GET | `/api/machines/:terminalId/ej?date=` | login | EJ Preview | REQ-HOME-002 | Target |
| GET | `/api/reports/daily?date=` | login | Daily Report & Performance | REQ-RPT-001, 002 | Target |
| POST | `/api/ej/merge` | login | Gabung EJ satu terminal untuk rentang tanggal, hasil file unduhan | REQ-MERGE-001 | Target |
| POST | `/api/ej/upload` | admin | Upload file EJ manual (multipart) | REQ-UPLOAD-001 | Target |

Kode status: 400 input tidak valid, 401 belum login, 403 bukan admin, 404 tidak ditemukan, 409 email sudah terdaftar, 429 terlalu banyak percobaan login.

## 5. Alur penting

**Login (flowchart Gambar 3.2):** `ej-web` kirim email + password → `ej-api` validasi format (400) → cek rate limit (429) → cari user dan bandingkan scrypt hash, selalu dengan waktu yang sama walau email tidak ada → gagal: 401, UI tetap di form login → sukses: cookie httpOnly berisi token HMAC 1 jam ([ADR-0002](adr/0002-signed-cookie-session.md)), UI pindah ke Daily Report.

**Ambil dan parsing EJ (target):**
1. `ej-ingest` berjalan tiap 5 menit, daftar file baru di folder SFTP Sumber EJ.
2. Unduh ke `data/ej/<terminal>/<tgl>/`, hitung SHA-256. Hash yang sudah ada dilewati, jadi job aman diulang (idempotent).
3. Catat di `ej_files` dengan status `received`.
4. `ej-parse` membaca file `received`, menulis `ej_transactions` dalam satu transaksi SQLite, lalu set `parsed`. Jika gagal: `failed` + pesan error; file mentah tetap disimpan untuk diproses ulang.
5. Upload EJ manual masuk ke langkah 3 dengan `source = 'upload'`.

**Retry:** koneksi SFTP gagal → coba lagi di jadwal berikutnya; tiga kali berturut-turut gagal → log error (dan nanti notifikasi, REQ-NOTIF-001).

## 6. Keamanan

- Password: scrypt dengan salt acak; hash tidak pernah dikirim ke browser atau MCP.
- Session: cookie `httpOnly`, `SameSite=Lax`, `Secure` di production; token ditandatangani `AUTH_SECRET`.
- Rate limit login per email + IP (5 kali / 15 menit).
- Otorisasi: perubahan user hanya untuk admin; admin tidak bisa menghapus atau menurunkan role dirinya sendiri.
- Akun SFTP: read-only di Sumber EJ, kredensial di `.env` server, tidak di repo.
- MCP server membuka database dalam mode read-only.

## 7. Skala dan keandalan

Dengan asumsi di atas: ±2.000 file × ±500 transaksi = ±1 juta baris per hari, ±30 juta baris per bulan. SQLite dengan index `(terminal_id, occurred_at)` masih memadai untuk query per mesin dan per hari, selama hanya satu proses yang menulis ([ADR-0001](adr/0001-sqlite-on-premise.md)).

- Penulisan: hanya `ej-ingest`/`ej-parse` dan `ej-api` (user). Aktifkan `PRAGMA journal_mode = WAL` saat tabel EJ ditambahkan, agar baca tidak terblokir saat parsing.
- Laporan harian: hitung agregat per hari setelah parsing selesai (tabel ringkasan), bukan menghitung ulang jutaan baris tiap kali halaman dibuka.
- Backup: salin file `.db` harian (SQLite `VACUUM INTO`) dan simpan file EJ mentah sesuai kebijakan retensi.
- Monitoring: endpoint `GET /health`; log jumlah file diterima, diparsing dan gagal per run.

## 8. Trade-off

| Keputusan | Dipilih | Alternatif | Alasan | Biaya |
| --- | --- | --- | --- | --- |
| Database | SQLite lokal | PostgreSQL, Supabase | Data tetap on-premise, tanpa server DB tambahan, cukup untuk volume v1 | Satu penulis saja; pindah DB jika multi-server |
| Session | Cookie bertanda tangan HMAC | Session di DB, JWT di localStorage | Sederhana, tidak bisa dibaca JavaScript | Tidak bisa mencabut satu session sebelum kedaluwarsa |
| Pengambilan EJ | Pull via SFTP terjadwal | Sumber EJ push ke dashboard | Firewall hanya perlu satu arah; Sumber EJ tidak perlu diubah | Keterlambatan hingga interval job |
| Routing UI | Hash route (`#/menu`) | React Router + history API | Tanpa dependensi, reload tetap di menu yang sama | URL kurang rapi |
| Struktur kode | Workspace terpisah `ej-*` | Menyatu dengan `apps/api` dan `apps/web` | Aplikasi demo yang ada tidak terganggu | Ada duplikasi kode auth |

## 9. Yang perlu ditinjau ulang saat sistem tumbuh

- Lebih dari satu server aplikasi atau penulis bersamaan → pindah ke PostgreSQL on-premise.
- Rate limit dan data session di memori → simpan di DB/Redis jika ada lebih dari satu instance.
- Kode auth terduplikasi di `apps/api` dan `apps/ej-api` → pindahkan ke paket bersama jika keduanya tetap dipakai.
- Data contoh di `packages/shared/src/ejSample.ts` → hapus setelah `/api/machines` dan `/api/reports/daily` memakai data asli.
