# ADR-0003: Workspace terpisah `ej-*` di monorepo

**Status:** Accepted
**Date:** 2026-10-24
**Deciders:** Vina (QA owner), Dev lead

## Context

Monorepo ini sudah berisi aplikasi demo login (`apps/api`, `apps/web`) beserta test-nya. Repository resmi EJ Dashboard dari developer belum tersedia, jadi EJ Dashboard dibangun di sini sebagai prototipe. Aplikasi demo tidak boleh rusak.

## Decision

Buat workspace baru: `apps/ej-api` (`@repo/ej-api`), `apps/ej-web` (`@repo/ej-web`) dan `apps/ej-mcp` (`@repo/ej-mcp`). Tipe, validasi dan data contoh bersama ditaruh di `packages/shared` (`ej.ts`, `ejSample.ts`). Script root: `dev:ej-api`, `dev:ej-web`. Port: API 3100, web 5174.

## Options Considered

### Option A: Workspace terpisah (dipilih)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Cost | Ada duplikasi kode auth |
| Scalability | Mudah dipindah ke repo sendiri |
| Team familiarity | Tinggi |

**Pros:** aplikasi demo tidak tersentuh; EJ bisa dipindah ke repo developer dengan menyalin folder `ej-*`.
**Cons:** kode auth (`password.ts`, `token.ts`, `rateLimit.ts`) disalin dari `apps/api`.

### Option B: Kembangkan `apps/api` dan `apps/web` langsung
**Pros:** tanpa duplikasi.
**Cons:** mengubah aplikasi demo dan test-nya; susah dipisah nanti.

### Option C: Repository baru
**Pros:** paling bersih.
**Cons:** kehilangan tooling yang sudah ada (CI, hook, skill); repo resmi dari developer akan datang juga.

## Trade-off Analysis

Duplikasi kecil lebih murah daripada risiko merusak aplikasi demo atau membuat repo yang nantinya diganti repo developer.

## Consequences

- Lebih mudah: memindahkan EJ Dashboard ke repo resmi.
- Lebih sulit: perbaikan keamanan auth harus diterapkan di dua tempat.
- Perlu ditinjau ulang: setelah repo developer tersedia, tentukan apakah kode ini dipindah atau hanya jadi referensi QA.

## Action Items

1. [x] Workspace `ej-api`, `ej-web`, `ej-mcp` dan script root
2. [ ] Pindahkan auth ke paket bersama jika `apps/api` tetap dipakai
