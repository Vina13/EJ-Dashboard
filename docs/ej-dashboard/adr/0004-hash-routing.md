# ADR-0004: Routing halaman dengan hash (`#/menu`)

**Status:** Accepted
**Date:** 2026-10-24
**Deciders:** Dev lead

## Context

`ej-web` punya sedikit menu (Home, Daily Report & Performance, User Management, Merge EJ, dan nanti EJ Parsing serta Upload EJ). Setelah reload, user harus tetap di menu yang sama, dan setelah login harus diarahkan ke Daily Report (flowchart).

## Decision

Halaman aktif disimpan di hash URL, misalnya `#/user-management`, lewat hook kecil `useHashRoute` di `apps/ej-web/src/menu.ts`. Daftar menu dan route didefinisikan di satu array `MENU`. Hash tidak dikenal kembali ke `daily-report`.

## Options Considered

### Option A: Hash routing buatan sendiri (dipilih)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low (±40 baris) |
| Cost | Nol, tanpa dependensi |
| Scalability | Cukup untuk < 15 halaman tanpa parameter |
| Team familiarity | Tinggi |

**Pros:** tanpa dependensi; server tidak perlu fallback ke `index.html`; mudah dites.
**Cons:** URL kurang rapi; belum ada parameter route (mis. `/machines/:id`).

### Option B: React Router dengan history API
**Pros:** standar, mendukung parameter dan nested route.
**Cons:** dependensi tambahan; server production harus mengarahkan semua path ke `index.html`.

## Trade-off Analysis

Untuk jumlah menu saat ini, hash routing cukup. Begitu butuh halaman detail per mesin dengan URL sendiri, pindah ke React Router lebih masuk akal.

## Consequences

- Lebih mudah: deploy sebagai file statis.
- Lebih sulit: deep link ke detail mesin atau tanggal tertentu.
- Perlu ditinjau ulang: saat REQ-RPT-002 (pilih tanggal) atau halaman detail mesin dibuat.

## Action Items

1. [x] `useHashRoute` dan `MENU` di `apps/ej-web/src/menu.ts`
