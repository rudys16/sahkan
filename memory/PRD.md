# Sahkan — Product Requirements (living doc)

## Original problem statement
Sahkan v1 — an institutional document verification platform. Tagline "Verifikasi. Privat. Terbukti."
OWNERs submit PDF documents for review by an AUTHORITY of a chosen institution. AUTHORITY approves/rejects.
Everything is signed (ECDSA P-384), hash-chained (WORM audit), and auditable. UI language: Indonesian.

## Architecture
- Frontend: React (CRA + craco, "@/" alias), Tailwind, react-router, sonner, framer-motion, @phosphor-icons, pdfjs-dist@4.4.168.
- Backend: Python FastAPI + Motor/MongoDB. All routes prefixed `/api`.
- Crypto (Python stdlib / cryptography): scrypt (hashlib), SHA-256 Merkle, AES-256-GCM (AESGCM), ECDSA P-384.
- Auth: JWT (24h) in httpOnly Secure cookie. OTP dev mode (fixed 123456, no email). Admin password (scrypt) with 5-attempt/15-min lockout.
- Collections: users, otpSessions (TTL), institutions, documents (TTL pendingExpiresAt), documentChunks, auditChain (+ chainState singleton), login_attempts.

## User personas
- OWNER (Pemohon): any email, OTP login, submits/tracks documents.
- AUTHORITY (Penerbit): corporate email suffix-matching institution domain, OTP login, admin approval required, reviews & decides.
- ADMIN: seeded via env, password login, approves authorities & inspects audit chain.

## Core requirements (static)
- Uploaded file NEVER stored permanently; encrypted blob only, wiped on decision.
- Atomic decision transition (no double decisions → 409).
- WORM insert-only SHA-256 hash-chained audit; tamper indicator on admin view.
- 4KB chunking + one deterministic Merkle odd-node rule (lone node promoted unchanged).
- AUTHORITY email domain suffix-matches institution domain (subdomains allowed).
- ECDSA P-384 signature over canonical envelope stored with the document.

## Implemented (2026-06-15)
- Full auth: OWNER/AUTHORITY OTP + ADMIN password, JWT cookie, role middleware, logout.
- Institutions: active list, create (domain suffix-match), join; admin approve/reject cascades to institution status.
- Document submit pipeline: magic-byte + size validation, non-destructive byte-scan report, 4KB chunk + Merkle root, duplicate 409, AES-256-GCM blob, chunk leaves, SUBMIT audit.
- Authority queue, secure pdf.js preview (JS never executed), atomic decide + Merkle re-verify + ECDSA sign + blob wipe + DECIDE audit, history.
- WORM audit chain with recompute/valid indicator, pagination.
- Seed: 3 ACTIVE institutions + ACTIVE authority each, admin from env, demo OWNER + one PENDING document (self-priming on restart).
- Bespoke "Seal System" dark UI (IBM Plex Sans/Mono, emerald/rose/amber seals, editorial asymmetric, hairline data tables, grain/grid textures, custom scrollbars/focus rings).
- Tested: backend 24/24 pytest, frontend all flows pass (iteration_1).

## Backlog (prioritized)
- P1: Public verification endpoint UI (verify a signature/docHash against the published public key).
- P2: Explicit CORS origin list for production; split server.py into modules; bundle pdf.js worker; add (email,purpose,createdAt) index on otpSessions.
- P2: Authority "create/join institution" onboarding UI (backend endpoints exist).

## Next tasks
- Await user feedback / choose a backlog item.
