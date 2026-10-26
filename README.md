# 🎟️ StagePass — Event Ticketing & Seating

A full-stack event ticketing platform: browse events, pick seats on an **interactive seat map**, pay, receive **QR tickets**, and validate entry at gates — with a complete **admin panel** for managing venues, events, sales, scans, and audits.

Built for the DBMS PBL (CSL_311) brief *"Event Ticketing & Seating"* on a **local PostgreSQL** database, with every one of the 10 business rules enforced at the database and service layer.

## ✨ Features

**Customer**
- Browse events with search, city & category filters
- Interactive SVG seat map with tiers, availability states, and 10-minute seat holds
- Atomic checkout: price/tax/fee snapshot locked at purchase, mock payment, instant ticket issuance
- QR tickets with transfer support

**Gate / Organizer**
- Scan portal: validate QR codes with reason-coded grants/denials (already scanned, wrong gate, cancelled event)
- Optional re-entry per event

**Admin**
- Dashboard: revenue, tickets sold, occupancy, live scan feed
- Manage venues (seat layout builder), events, ticket tiers, users
- Complimentary ticket issuance, event cancellation with refund records
- Append-only audit log of every sale, assignment, scan, transfer, and refund

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router, TypeScript) — UI + REST API in one app |
| Database | PostgreSQL 18 (local, portable — no admin needed), raw SQL migrations, `pg` pool |
| Auth | JWT in httpOnly cookies, `middleware.ts` route gating, bcrypt |
| Jobs | `node-cron` hold sweeper started from `instrumentation.ts` |
| Styling | Tailwind CSS with custom palette tokens (see DESIGN.md) |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 18 — this project ships with a **portable, no-admin** setup (step 1 below). Any local PostgreSQL 16+ works too if you prefer your own server.

### 1. Start PostgreSQL
The default setup is a self-contained cluster in your user profile — no Windows service, no admin rights:

| Piece | Location |
|-------|----------|
| Binaries | `~/postgres-pg18/pgsql` (EDB binaries zip, PostgreSQL 18.6) |
| Data dir | `~/postgres-stagepass` — port **5433**, database `stagepass`, user `postgres` / `postgres` |
| Auto-start | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start-stagepass-postgres.vbs` — starts the cluster silently at Windows logon |

```bash
npm run db:start     # start the cluster (also auto-starts at logon)
npm run db:status     # ✔ running / ○ not running
npm run db:stop      # stop it
```

Using your own PostgreSQL instead? Create a `stagepass` database and point `DATABASE_URL` in `.env` at it (default port 5432).

### 2. Run the app (single Next.js project)
```bash
npm install
cp .env.example .env        # DATABASE_URL already points at localhost:5433/stagepass
npm run db:migrate          # runs src/db/migrations/*.sql in order
npm run db:seed             # demo venues, seats, events, tiers, users
npm run dev                 # http://localhost:3000 · admin panel at /admin
```

> **Troubleshooting:** a `Runtime AggregateError` in `pool.ts` while rendering any page means PostgreSQL isn't running — run `npm run db:start` and refresh.

### Demo accounts (from seed)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@stagepass.test` | `Admin@123` |
| Customer | `customer@stagepass.test` | `Customer@123` |
| Scanner (gate) | `scanner@stagepass.test` | `Scanner@123` |

### 3. Verify everything
```bash
npm run typecheck           # tsc --noEmit
npm run build               # production build (19 pages + 25 API routes)
npm run e2e                 # 23-check smoke suite covering all 10 business rules
```

## 📁 Project Structure

See `IMPLEMENTATION_PLAN.md` §2 for the full tree. Short version:

```
src/app/(customer)/    storefront: browse, event detail, seat map, checkout, my tickets
src/app/admin/         admin panel: dashboard, events, venues, scans, users, audit log
src/app/api/v1/        REST route handlers: auth, events, holds, bookings, scans, admin
src/db/                pg pool · SQL migrations · seeds
src/lib/               auth & rbac · booking engine · scan service · audit · QR
src/instrumentation.ts node-cron hold sweeper
```

Planning docs (README.md · IMPLEMENTATION_PLAN.md · DESIGN.md) live in the project root.

## 🔗 API Overview

Base URL: `/api/v1` — full table in `IMPLEMENTATION_PLAN.md` §5.

- `POST /auth/register` · `POST /auth/login`
- `GET /events` · `GET /events/:id` · `GET /venues/:id/seats`
- `POST /events/:id/holds` · `DELETE /holds/:id` · `POST /bookings/checkout`
- `GET /tickets/mine` · `POST /tickets/:id/transfer`
- `POST /scans/validate`
- `/admin/*` — events, venues, tiers, comps, cancel+refunds, stats, audit log

## 📏 Business Rules (1–10) — enforced

1. Events require a valid venue + ordered start/end times → FK + `CHECK`
2. Seat IDs unique per venue/layout → composite `UNIQUE`
3. No double-sell per event → transaction + partial unique index
4. Price/tax/fee frozen at purchase → snapshot columns on `tickets`
5. Valid only after payment/comp → status flip inside the payment transaction
6. Unique ticket number + QR code → `UNIQUE` columns, opaque signed token
7. Single successful scan (unless re-entry) → guarded insert + partial index
8. Cancelled events stop sales + refunds → status gate + refund records
9. Holds expire automatically → cron sweeper + server-side re-check
10. Full audit trail → `audit_logs` written on every mutation

## 📚 Docs

- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — architecture, schema, API, phases, testing
- [`DESIGN.md`](./DESIGN.md) — color system (`#2B5E8C`, `#66A3BF`, `#D9E8E3`, `#F7F3EC`), typography, components, page specs

## 🗺️ Roadmap

- [ ] Phases 0–6 per implementation plan
- [ ] Real payment provider adapter (Stripe test mode)
- [ ] Organizer role portal (own events only)
- [ ] Email delivery of QR tickets
"# event-ticketing-system" 
