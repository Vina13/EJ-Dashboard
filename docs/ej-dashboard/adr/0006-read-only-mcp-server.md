# ADR-0006: MCP server EJ Dashboard yang hanya membaca

**Status:** Accepted
**Date:** 2026-10-24
**Deciders:** Vina (QA owner), Dev lead

## Context

Tim QA memakai Claude Code untuk analisis dan testing. Agar Claude bisa menjawab pertanyaan seperti "mesin mana yang offline?" atau "siapa saja admin?" tanpa membuka UI, data EJ Dashboard perlu tersedia sebagai tool MCP. Akses ini tidak boleh bisa mengubah data.

## Decision

`apps/ej-mcp` menjalankan MCP server lewat stdio (terdaftar di `.mcp.json` sebagai `ej-dashboard`) dengan empat tool: `list_users`, `list_machines`, `get_daily_report`, `get_ej_preview`. Database dibuka dengan `readOnly: true`, semua tool ditandai `readOnlyHint`, dan password hash tidak pernah dikembalikan. Mesin, laporan dan EJ masih memakai data contoh dari `packages/shared`.

## Options Considered

### Option A: MCP server read-only langsung ke file SQLite (dipilih)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Cost | Nol |
| Scalability | Cukup untuk satu pengguna lokal |
| Team familiarity | Sedang |

**Pros:** tidak butuh login atau API berjalan; tidak bisa menulis.
**Cons:** melewati lapisan otorisasi `ej-api`; hanya untuk mesin lokal developer/QA.

### Option B: MCP server yang memanggil `ej-api` dengan akun khusus
**Pros:** memakai otorisasi yang sama dengan UI.
**Cons:** API harus berjalan; perlu menyimpan kredensial akun MCP.

## Trade-off Analysis

Untuk pemakaian lokal oleh tim QA, akses read-only langsung lebih sederhana dan aman. Jika MCP dipakai di server bersama, Option B lebih tepat.

## Consequences

- Lebih mudah: Claude bisa membaca data untuk analisis dan menyusun test.
- Lebih sulit: menjaga hasil tool tetap sama dengan API saat data asli ditambahkan.
- Perlu ditinjau ulang: saat `/api/machines` dan `/api/reports/daily` memakai data asli, tool MCP harus memakai query yang sama.

## Action Items

1. [x] Empat tool read-only dengan test di `apps/ej-mcp/src/server.test.ts`
2. [ ] Ganti data contoh dengan query ke tabel EJ setelah ADR-0005 diimplementasikan
