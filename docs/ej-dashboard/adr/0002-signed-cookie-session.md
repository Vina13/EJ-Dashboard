# ADR-0002: Session lewat cookie httpOnly bertanda tangan HMAC

**Status:** Accepted
**Date:** 2026-10-24
**Deciders:** Dev lead, Vina (QA owner)

## Context

Semua menu dan API EJ Dashboard butuh login (REQ-AUTH-005). Penggunanya sedikit (≤ 50), dan aplikasi berjalan di satu server. Token tidak boleh bisa dibaca JavaScript di browser.

## Decision

Setelah login sukses, `ej-api` mengirim cookie `ej_session` (httpOnly, SameSite=Lax, Secure di production) berisi `base64url(payload).HMAC-SHA256`. Payload berisi id user, waktu kedaluwarsa (1 jam) dan sidik jari pendek dari password hash. Setiap request yang butuh login memverifikasi tanda tangan, memastikan user masih ada di database, dan mencocokkan sidik jari itu. Jadi begitu password user diganti, semua session lama user itu langsung tidak berlaku. Web memanggil `/api` lewat proxy Vite agar same-origin, jadi tidak perlu CORS.

## Options Considered

### Option A: Cookie bertanda tangan, tanpa tabel session (dipilih)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Cost | Nol |
| Scalability | Baik; tidak ada state session di server |
| Team familiarity | Tinggi (pola sama dengan `apps/api`) |

**Pros:** tidak ada tabel session; tidak bisa dibaca JavaScript; user yang dihapus atau diganti passwordnya langsung kehilangan akses.
**Cons:** satu session tertentu tidak bisa dicabut tanpa mengganti password user itu (atau `AUTH_SECRET` untuk semua user).

### Option B: Tabel session di SQLite
**Pros:** bisa mencabut session tertentu, bisa melihat siapa yang sedang login.
**Cons:** satu query tambahan per request, perlu pembersihan session kedaluwarsa.

### Option C: JWT di localStorage
**Pros:** umum di SPA.
**Cons:** bisa dicuri lewat XSS; tidak dipilih.

## Trade-off Analysis

Dengan TTL 1 jam dan pengecekan user di database setiap request, risiko session yang tidak bisa dicabut kecil: user yang dihapus atau diganti perannya langsung terdampak. Option B baru perlu jika ada kebutuhan audit login (REQ-AUDIT-001).

## Consequences

- Lebih mudah: tanpa state session, sama dengan aplikasi `apps/api`.
- Lebih sulit: "logout dari semua perangkat".
- Tanpa `AUTH_SECRET` di `.env`, mode development memakai secret acak, sehingga semua user ter-logout setiap kali API restart.

## Action Items

1. [x] Token, cookie dan rate limit login di `apps/ej-api/src/auth/`
2. [ ] Set `AUTH_SECRET` di `.env` server sebelum UAT
