# Implementation Plan — StagePass: Event Ticketing & Seating

A full-stack event ticketing platform with interactive seat maps, ticket tiers, payments, QR-based entry validation, and an admin panel. Built for the DBMS PBL (CSL_311) brief using a **local PostgreSQL** database.

---

## 1. Requirements Summary (from the project brief)

**Scope:** Sell tickets with seat maps, tiers, and QR validation.

**Core entities:** `Venues`, `Seats`, `Events`, `Tickets`, `Users`, `Scans`, `Payments` (+ `TicketTiers`, `SeatHolds`, `AuditLogs` to satisfy the rules).

**The 10 business rules and how each is enforced:**

| # | Rule | Enforcement mechanism |
|---|------|----------------------|
| 1 | Event scheduled at one valid venue with start & end time | `events.venue_id NOT NULL REFERENCES venues`, `CHECK (ends_at > starts_at)`, FK must exist (validated in service layer too) |
| 2 | Seat identifiers unique within a venue/layout | `UNIQUE (venue_id, section, row_label, seat_number)` on `seats` |
| 3 | No seat sold more than once per event | Partial unique index: `UNIQUE (event_id, seat_id) WHERE status IN ('sold','used')` on `tickets`; purchase happens inside a `SERIALIZABLE`/`FOR UPDATE` transaction |
| 4 | Tier, price, taxes, fees fixed at purchase time | `tickets` stores snapshot columns (`tier_id, base_price, tax_amount, fee_amount, total_price`) copied from the tier at checkout — never re-read later |
| 5 | Ticket valid only after successful payment or authorized comp | `tickets.status` starts as `pending`; flipped to `active` only inside the same transaction that records a `payments` row with `status='succeeded'` (or an admin comp action writing `payments.method='comp'`) |
| 6 | Unique ticket number + QR/validation code per ticket | `UNIQUE (ticket_number)`, `UNIQUE (qr_code)`; generated as `TCK-<event><seq>` and a signed random token; QR payload = validation code |
| 7 | One successful scan per ticket unless re-entry allowed | `scans` insert guarded by: ticket active, scan gate authorized, and `NOT EXISTS (prior successful scan)` unless `events.reentry_allowed = true` — enforced via transaction + partial index `UNIQUE (ticket_id) WHERE result='granted'` when re-entry is off |
| 8 | Cancelled events stop sales & trigger refunds | `events.status` (`scheduled|cancelled|completed`); sale endpoints reject cancelled events; cancel endpoint enqueues refund records from `payments` per policy |
| 9 | Seat holds expire automatically | `seat_holds(expires_at)`; a node-cron sweeper deletes/voids expired holds every 30s, and purchase re-validates hold freshness server-side (defense in depth) |
| 10 | Everything auditable | `audit_logs(id, actor_id, action, entity_type, entity_id, before/after JSONB, created_at)` written by service layer on every mutation (sales, seat assignment, scans, cancels, transfers, refunds) — append-only |

---

## 2. Architecture

```
┌──────────────────────────────────────────────┐
│        React 19 UI — Next.js 15 (App Router) │
│  - Customer storefront  ·  Admin dashboard   │
│  - Server components call the REST API       │
│  - /api/v1/* proxied via next.config rewrite │
└──────────────────────┬───────────────────────┘
                       │ HTTP (JSON)
┌──────────────────────▼───────────────────────┐
│        Express.js REST API (server/)         │
│  - Auth (bcrypt + JWT httpOnly cookie)       │
│  - express-validator, CORS, multer uploads   │
│  - Central error handler                     │
│  - Booking engine (txns) · QR generate/verify│
│  - node-cron hold sweeper                    │
└──────────────────────┬───────────────────────┘
                       │ pg (pool)
                ┌──────▼───────┐
                │ PostgreSQL   │
                └──────────────┘
```

**Repository layout (React frontend + Express backend):**

```
stagepass/
├── src/
│   ├── app/
│   │   ├── (customer)/      # browse, event detail, seat selection, checkout, my tickets
│   │   ├── admin/           # admin panel: dashboard, events, venues, scans, users, audit
│   │   ├── layout.tsx       # root layout, fonts
│   │   └── globals.css      # design tokens from DESIGN.md
│   ├── components/          # SeatMap, EventCard, QRCode, charts, data tables
│   ├── lib/                 # JWT verification + REST API client for server components
│   ├── db/migrations/       # plain SQL, numbered
│   └── middleware.ts        # JWT cookie auth + role gating for /admin and /scan
├── server/                  # Express backend
│   ├── index.js             # app bootstrap, CORS, routers, error handler, sweeper
│   ├── auth.js              # bcrypt + jsonwebtoken + requireRole
│   ├── errors.js            # ApiError + central error handler
│   ├── validation.js        # express-validator result middleware
│   ├── routes/              # auth, events, venues, booking, scans, uploads, admin
│   └── services/            # SQL + business rules
├── database/schema.sql      # single-file PostgreSQL schema
├── .env.example             # DATABASE_URL, JWT_SECRET, API_PORT, CORS origins
└── scripts/                 # migrate, seed, e2e
```

## 3. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| DB | PostgreSQL 16+ | project decision (MySQL in the brief); rich constraint support (partial indexes) maps directly to the rules |
| DB access | `pg` + raw SQL migrations | a DBMS project should show real SQL: DDL, constraints, triggers, indexes |
| API | Node.js + **Express.js** (`server/`) | REST API required by the brief; `cors`, `express-validator`, `multer`, `jsonwebtoken` |
| Framework | Next.js 15 (App Router) + TypeScript | React UI; server components consume the REST API |
| Auth | JWT in httpOnly cookie, `middleware.ts` gating, bcrypt hashes | roles: `customer`, `organizer`, `admin`, `scanner` |
| QR | `qrcode` (server-side PNG/data-URL), verify by token lookup | rule 6/7 |
| Jobs | `node-cron` started from `server/index.js` | rule 9 hold expiry |
| Rendering | React Server Components + client components | server-fetched data (events, seats); interactive seat map as a client component |
| Styling | Tailwind CSS v4 with custom tokens from DESIGN.md | modern, clean, palette-driven |
| Validation | `express-validator` on the API + HTML5/React checks in forms | consistent 422 errors |

## 4. Database Schema (key tables)

```
users(id, email UNIQUE, password_hash, full_name, role, created_at)
venues(id, name, address, city, capacity)
seats(id, venue_id FK, section, row_label, seat_number,
      UNIQUE(venue_id, section, row_label, seat_number))            -- rule 2
ticket_tiers(id, event_id FK, name, base_price, tax_rate, fee_amount,
      quantity, sales_start, sales_end)
events(id, venue_id FK NOT NULL, title, description, category,
      starts_at, ends_at, status, reentry_allowed,                   -- rules 1, 7, 8
      CHECK(ends_at > starts_at))
seat_holds(id, event_id, seat_id, user_id, expires_at,
      UNIQUE(event_id, seat_id))                                     -- rule 9
payments(id, ticket_id FK, user_id, method, amount, tax_amount,
      fee_amount, status, provider_ref, created_at)                  -- rules 4, 5
tickets(id, event_id, seat_id, tier_id, user_id, ticket_number UNIQUE,
      qr_code UNIQUE, status, base_price, tax_amount, fee_amount,
      total_price, issued_at,                                        -- rules 3-6
      UNIQUE(event_id, seat_id) WHERE status IN ('sold','used'))
scans(id, ticket_id FK, gate_id, scanned_by, result, reason, scanned_at)
refunds(id, payment_id FK, amount, status, reason, created_at)       -- rule 8
audit_logs(id, actor_id, action, entity_type, entity_id,
      old_data JSONB, new_data JSONB, created_at)                    -- rule 10
```

Indexes: `events(starts_at)`, `events(status)`, `tickets(user_id)`, `tickets(event_id)`, `scans(ticket_id, scanned_at)`, partial unique indexes for rules 3 and 7.

## 5. API Surface (v1)

| Method & path | Purpose | Access |
|---|---|---|
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | bcrypt + JWT session | public / user |
| `GET /events`, `GET /events/:id` (with tier availability) | search, filter, pagination, detail | public |
| `POST /events`, `PUT /events/:id`, `DELETE /events/:id` | event CRUD | admin |
| `GET /events/:id/seats` | live seat map | public |
| `GET /venues`, `GET /venues/:id`, `GET /venues/:id/seats` | venue + layout | public |
| `POST /venues`, `PUT /venues/:id`, `DELETE /venues/:id` | venue CRUD | admin |
| `POST /events/:id/holds` | hold selected seats (10 min) | customer |
| `GET /holds`, `DELETE /holds` | list / release holds | customer |
| `POST /bookings/checkout` | atomically: validate holds → snapshot prices (rule 4) → payment → activate ticket → audit | customer |
| `GET /tickets/mine`, `POST /tickets/:id/transfer` | my tickets + QR; audited transfer | customer |
| `POST /scans/validate` | `{ qr_code, gate_id }` → grant/deny + reason (rule 7) | scanner/organizer/admin |
| `POST /uploads` | multer upload (event banner) | admin/organizer |
| `GET /admin/stats`, `GET /admin/audit` | revenue, occupancy, scan feed, audit log | admin |
| `GET /admin/events`, `POST /admin/events/:id/cancel` | event oversight; stop sales + refunds (rule 8) | admin |
| `GET/POST /admin/users`, `PATCH/DELETE /admin/users/:id` | user CRUD and role changes | admin |
| `POST /admin/tickets/comp` | complimentary issuance (rule 5) | admin |
| `GET /health` | API + database liveness | public |

## 6. Delivery Phases

**Phase 0 — Setup (0.5 day)**
Repo scaffolding, local Postgres install/config, env files, docker-compose option, linting, design tokens.

**Phase 1 — Database core (1 day)**
Migrations for all tables + constraints + indexes; seed script (2 venues with layouts, 4 events, tiers, demo users); verify rules 1–3 with SQL tests.

**Phase 2 — Backend services (2 days)**
Auth; events/venues read APIs; hold endpoints + sweeper (rule 9); checkout transaction (rules 3–6); audit middleware (rule 10).

**Phase 3 — Scanning & refunds (1 day)**
QR generation on ticket creation; `/scans/validate` with all deny reasons; event cancellation with refund records (rules 7–8); comp issuance.

**Phase 4 — Frontend customer (2 days)**
Home/browse, event detail, **interactive seat map** (click-to-select, hold countdown, tier legend), checkout, "My Tickets" with QR display, auth pages. Styling per DESIGN.md.

**Phase 5 — Admin panel (1.5 days)**
Dashboard (revenue, tickets sold, occupancy, recent scans), event & venue management, tier management, cancel-event flow, manual scan portal, audit log viewer.

**Phase 6 — Hardening (1 day)**
Integration tests for every business rule (one test per rule), rate limiting on holds, input validation pass, seed data polish, README/demo script.

## 7. Testing Strategy

- **SQL-level tests:** script that attempts each forbidden operation (double-sell, duplicate seat, scan-after-scan, sale-on-cancelled-event) and asserts the DB rejects it.
- **API integration tests:** Jest + supertest against a scratch database; one test per business rule (rules 1–10).
- **UI smoke:** manual checklist of the 5 key flows (browse → select seats → checkout → view QR → scan).

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Concurrent checkout race (rule 3) | transaction + partial unique index as the final guard |
| Hold sweeper down | checkout re-checks hold expiry server-side |
| QR sharing/fraud | QR is a random opaque token, single-use, logged per scan |
| Mock payments complexity | simulate a payment provider with a deterministic "always succeeds unless card ends in 0002" service |
