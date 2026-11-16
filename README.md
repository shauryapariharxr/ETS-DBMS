# 🎟️ StagePass — Event Ticketing & Seating (Full Stack PBL)

A full-stack event ticketing platform: browse events, pick seats on an **interactive seat map**, pay, receive **QR tickets**, and validate entry at gates — plus a complete **admin panel** for venues, events, users, sales, scans and refunds.

| Layer | Stack |
|-------|-------|
| Frontend | **React 19** via Next.js 15 (App Router, TypeScript, Tailwind CSS v4) — responsive HTML/CSS/JS UI |
| Backend | **Node.js + Express.js** REST API (`server/`), 34 endpoints, CORS, central error handler |
| Database | **PostgreSQL** (10 related tables, PK/FK/CHECK constraints, JOIN queries) — kept instead of MySQL by project decision |

> **Note on the database:** the brief asks for MySQL; this submission deliberately keeps **PostgreSQL** (project requirement) and ships `database/schema.sql` written in SQL. Everything else in the brief — Express backend, JWT + bcrypt auth, 2+ roles, 15+ REST endpoints, CRUD, validation, search/filter/pagination, admin dashboard, file upload, security — is implemented.

---

## 📋 Guideline compliance

| Requirement | Status | Where |
|---|---|---|
| React frontend, responsive UI | ✅ | `src/app/**` (mobile / tablet / desktop, Tailwind) |
| Node.js + Express.js REST API | ✅ | `server/index.js` + `server/routes/*` |
| Database (PostgreSQL kept) | ✅ | `src/db/migrations/*.sql`, `database/schema.sql` |
| Register + login, bcrypt hash, JWT, logout | ✅ | `server/routes/auth.js`, `server/auth.js` (bcryptjs + jsonwebtoken) |
| At least 2 user roles | ✅ 4 roles | `customer`, `organizer`, `admin`, `scanner` |
| 15+ REST endpoints, GET/POST/PUT/PATCH/DELETE | ✅ 34 | see [API reference](#-api-reference) |
| Proper status codes (200/201/400/401/403/404/500) | ✅ | 400, 401, 402, 403, 404, 409, 415, 422, 500 |
| 6+ related tables, PK, FK, JOIN query, SQL file | ✅ 10 tables | `database/schema.sql` |
| Full CRUD for main entities | ✅ | events, venues, users (`server/routes/events.js`, `venues.js`, `admin.js`) |
| Validation frontend + backend | ✅ | HTML5/React form checks + `express-validator` |
| Search, filter, pagination | ✅ | `GET /api/v1/events?q=&city=&category=&page=&limit=` + UI paging |
| Admin dashboard with counts/summaries | ✅ | `GET /api/v1/admin/stats` + `/admin` |
| File upload with multer | ✅ | `POST /api/v1/uploads` (event banner, JPG/PNG/WEBP/GIF/PDF, 4 MB) |
| Security: `.env`, parameterised SQL, CORS | ✅ | `.env.example`, `$1..$n` everywhere, CORS allowlist |
| Central error-handling middleware | ✅ | `server/errors.js` (`errorHandler`, `ApiError`, PG error mapping) |
| Extras (charts, dashboards) | ✅ | revenue chart, occupancy bars, audit trail, auto refunds |

Still to submit separately (not code): the 50+ page project report and the 15–20 slide PPT. Section 8 of the report can use the API table below.

---

## 🚀 Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (this repo ships a portable, no-admin PostgreSQL 18 setup — see below)

### 1. Start PostgreSQL
| Piece | Location |
|-------|----------|
| Binaries | `~/postgres-pg18/pgsql` |
| Data dir | `~/postgres-stagepass` — port **5433**, database `stagepass`, user `postgres` / `postgres` |
| Auto-start | Windows Startup shortcut `start-stagepass-postgres.vbs` |

```bash
npm run db:start     # start the cluster (auto-starts at logon too)
npm run db:status    # ✔ running / ○ not running
npm run db:stop      # stop it
```

Using your own PostgreSQL? Create a `stagepass` database and point `DATABASE_URL` in `.env` at it.

### 2. Install and prepare
```bash
npm install
cp .env.example .env       # then adjust DATABASE_URL / JWT_SECRET if needed
npm run db:migrate         # applies src/db/migrations/*.sql in order
npm run db:seed            # demo users, venues, seats, events, tiers, tickets
```

### 3. Run both servers (two terminals)
```bash
npm run api                # Express REST API → http://localhost:4000
npm run dev                # React frontend    → http://localhost:3000
```
The frontend proxies `/api/v1/*` and `/uploads/*` to the API (`next.config.ts` rewrites), so the
httpOnly JWT cookie stays first-party. The browser can also call the API directly — CORS allows
`FRONTEND_ORIGIN`.

### Demo accounts (from seed)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@stagepass.test` | `Admin@123` |
| Organizer | `organizer@stagepass.test` | `Organizer@123` |
| Customer | `customer@stagepass.test` | `Customer@123` |
| Scanner (gate) | `scanner@stagepass.test` | `Scanner@123` |

### Verify
```bash
npm run typecheck   # tsc --noEmit
npm run build       # production Next.js build
npm run e2e         # 24-check API smoke suite (needs `npm run api` + `npm run dev`)
```

---

## 🏗️ Architecture

```
React UI (Next.js, port 3000)
   │  /api/v1/*  (same-origin proxy rewrite)
   ▼
Express REST API (port 4000)
   │  pg Pool, parameterised SQL, transactions
   ▼
PostgreSQL (stagepass)
```

```
event-ticketing-system/
├── server/                     Express backend
│   ├── index.js                app bootstrap, CORS, routers, error handler, cron sweeper
│   ├── config.js               env-driven configuration
│   ├── db.js                   pg pool, q(), withTransaction()
│   ├── auth.js                 bcrypt, jsonwebtoken, requireRole()
│   ├── errors.js              ApiError + central error-handling middleware
│   ├── validation.js           express-validator result middleware
│   ├── audit.js / qr.js        append-only audit writer, ticket numbers, QR PNG
│   ├── routes/                 auth, events, venues, booking, scans, uploads, admin
│   ├── services/               events, venues, booking, scans, admin (SQL + business rules)
│   └── uploads/                multer destination (git-ignored)
├── src/                        React frontend (Next.js App Router)
│   ├── app/(pages)             storefront, seats, checkout, tickets, admin, scan portal
│   ├── components/             SeatPicker, Header/Footer, status chips
│   ├── lib/auth.ts             JWT verification for server components
│   ├── lib/queries.ts          calls the Express API (no direct DB access in the UI)
│   ├── middleware.ts           role gating for /admin and /scan
│   └── db/migrations/          numbered SQL migrations
├── database/schema.sql         single-file PostgreSQL schema for submission/import
├── scripts/                    migrate, seed, db server control, e2e suite
└── .env.example                every environment variable
```

**Roles and access**
| Role | Can do |
|------|--------|
| Customer | Browse, hold seats, checkout, view QR tickets, transfer tickets |
| Organizer | Admin panel read access + scan portal |
| Admin | Everything: event/venue/user CRUD, comps, cancel + refund, audit log, dashboard |
| Scanner | Gate validation only (`/scan`) |

---

## 🔗 API reference

Base URL: `/api/v1` — auth via httpOnly `sp_session` cookie **or** `Authorization: Bearer <jwt>`.
Validation errors return `422`; every handler returns `{ error, code }` on failure.

### Auth
| Method | Endpoint | Auth | Body / notes | Status |
|---|---|---|---|---|
| POST | `/auth/register` | – | `{ full_name, email, password }` | 201, 409, 422 |
| POST | `/auth/login` | – | `{ email, password }` → sets JWT cookie | 200, 401 |
| POST | `/auth/logout` | – | clears the cookie | 200 |
| GET | `/auth/me` | user | current session | 200, 401 |

### Events (search, filter, pagination, CRUD)
| Method | Endpoint | Auth | Body / query | Status |
|---|---|---|---|---|
| GET | `/events` | – | `?q=&city=&category=&page=&limit=&sort=&order=` → `{ events, cities, pagination }` | 200 |
| GET | `/events/:id` | – | event + tiers + availability | 200, 404 |
| POST | `/events` | admin | `{ venue_id, title, category, starts_at, ends_at, reentry_allowed, banner_url, tiers[] }` | 201, 404, 422 |
| PUT | `/events/:id` | admin | partial event fields (any subset) | 200, 404, 409, 422 |
| DELETE | `/events/:id` | admin | only while no tickets exist | 200, 404, 409 |
| GET | `/events/:id/seats` | – | live seat map `{ seats: [{ state }] }` | 200, 404 |
| POST | `/events/:id/holds` | customer | `{ seat_ids: number[] }` (max 8) | 201, 400, 401, 409 |

### Venues (CRUD)
| Method | Endpoint | Auth | Body | Status |
|---|---|---|---|---|
| GET | `/venues` | – | seat/section counts | 200 |
| GET | `/venues/:id` | – | venue + section detail | 200, 404 |
| GET | `/venues/:id/seats` | – | raw seat rows | 200, 404 |
| POST | `/venues` | admin | `{ name, address, city, sections:[{ name, tier, rows[], perRow }] }` | 201, 422 |
| PUT | `/venues/:id` | admin | `{ name?, address?, city? }` | 200, 404 |
| DELETE | `/venues/:id` | admin | blocked while events reference it | 200, 404, 409 |

### Booking & tickets
| Method | Endpoint | Auth | Body | Status |
|---|---|---|---|---|
| GET | `/holds` | customer | my live holds | 200, 401 |
| DELETE | `/holds` | customer | `{ hold_ids }` releases seats | 200, 401 |
| POST | `/bookings/checkout` | customer | `{ hold_ids, method: "card"\|"upi", card_last4 }` | 201, 402, 409, 422 |
| GET | `/tickets/mine` | customer | tickets + QR PNG data URLs | 200, 401 |
| POST | `/tickets/:id/transfer` | customer | `{ to_email }` | 200, 400, 404, 409 |

### Scanning, uploads, admin
| Method | Endpoint | Auth | Body / notes | Status |
|---|---|---|---|---|
| POST | `/scans/validate` | scanner/admin/organizer | `{ qr_code, gate_id }` → granted/denied + reason | 200, 400, 403 |
| POST | `/uploads` | admin/organizer | `multipart/form-data` field `file` → `{ url }` | 201, 400, 415 |
| GET | `/admin/stats` | admin | revenue, tickets, events, scans, 14-day series, occupancy, recent scans | 200, 403 |
| GET | `/admin/events` | admin/organizer | `?q=&status=&page=&limit=` | 200 |
| GET | `/admin/users` | admin | `?q=&role=&page=&limit=` | 200 |
| POST | `/admin/users` | admin | `{ full_name, email, password, role }` | 201, 409, 422 |
| PATCH | `/admin/users/:id` | admin | `{ full_name?, role? }` (blocks removing the last admin) | 200, 404, 409 |
| DELETE | `/admin/users/:id` | admin | blocked for accounts with history | 200, 404, 409 |
| GET | `/admin/audit` | admin | `?q=&action=&page=&limit=` → `{ logs, refunds, pagination }` | 200 |
| POST | `/admin/events/:id/cancel` | admin | `{ reason }` → refunds every succeeded payment | 200, 404, 409 |
| POST | `/admin/tickets/comp` | admin | `{ event_id, seat_id, customer_email }` | 201, 404, 409 |
| GET | `/health` | – | API + database liveness | 200 |

---

## 📏 Business rules (enforced)

1. Events require a valid venue and ordered start/end times → FK + `CHECK`
2. Seat identifiers unique per venue/layout → composite `UNIQUE`
3. No double-sell per event → transaction + partial unique index on live tickets
4. Price/tax/fee frozen at purchase → snapshot columns on `tickets`
5. Ticket valid only after payment or authorized comp → status flip inside the payment transaction
6. Unique ticket number + QR code → `UNIQUE` columns, opaque random token
7. Single successful scan unless re-entry is allowed → guarded insert + scan history
8. Cancelled events stop sales and refund automatically → status gate + `refunds` rows
9. Holds expire automatically → Express `node-cron` sweeper every 30 s + checkout re-check
10. Full audit trail → append-only `audit_logs` on every mutation

---

## 🌍 Deployment

The brief requires all three parts online. This repo ships the config for it: a Render
blueprint for the API + managed PostgreSQL, a portable `Dockerfile`, and the environment
variables for a Vercel frontend.

| Part | Host | Config |
|------|------|--------|
| PostgreSQL | Render (provisioned by the blueprint) or Neon / Railway / Aiven | `render.yaml` → `databases` |
| Express API | Render (Node runtime) or any Docker host | `render.yaml`, `Dockerfile` |
| React frontend | Vercel (auto-detects Next.js) | env vars in step 2 |

### 1. API + database on Render
1. Push this repo to GitHub.
2. Render Dashboard → **New → Blueprint** → pick the repository. Render reads `render.yaml` and creates
   `stagepass-api` (health check `/api/v1/health`) plus `stagepass-db`, wiring `DATABASE_URL` automatically.
3. Open the service's **Shell** tab and initialise the database (the shell has `DATABASE_URL`):
   ```bash
   npm run db:migrate     # 10 tables, indexes, constraints
   npm run db:seed        # optional demo users/events for the viva
   ```
4. Copy the service URL (e.g. `https://stagepass-api.onrender.com`) and confirm
   `https://…/api/v1/health` returns `{"status":"ok","database":"connected"}`.

> Free instances sleep when idle, so the first request can take ~30–50 s. Render's free
> PostgreSQL expires after 30 days — swap `DATABASE_URL` for Neon/Railway/Aiven before then.

Any Docker host works too:
```bash
docker build -t stagepass-api .
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/stagepass \
  -e JWT_SECRET=change-me -e FRONTEND_ORIGIN=https://your-frontend.example \
  stagepass-api
```
On Railway: New Project → Deploy from repo (it picks up the `Dockerfile`), add the same variables,
then run `npm run db:migrate` in its shell.

### 2. Frontend on Vercel
1. Vercel → **Add New → Project** → import the repo (Next.js is detected automatically).
2. Add these environment variables for Production and Preview **before** the first build:
   - `API_URL=https://stagepass-api.onrender.com`
   - `NEXT_PUBLIC_API_URL=https://stagepass-api.onrender.com`

   `next.config.ts` bakes them into the `/api/v1` and `/uploads` proxies at build time, so re-deploy
   after changing them.
3. Deploy and note the URL, e.g. `https://stagepass.vercel.app`.

### 3. Close the loop
- On Render set `FRONTEND_ORIGIN=https://stagepass.vercel.app` (comma-separated if you add a custom
  domain) and redeploy. That is the CORS allowlist — without it, direct browser calls to the API
  return `403 CORS_BLOCKED`.
- Sign in on the live frontend with `admin@stagepass.test / Admin@123` and check the dashboard loads.

### API environment variables
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | HS256 signing key (the blueprint generates one) |
| `FRONTEND_ORIGIN` | yes in production | CORS allowlist, comma separated |
| `PORT` / `API_PORT` | platform-provided | listen port (`PORT` is picked up automatically) |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | production | `none` + `true` for cross-site cookie use |
| `JWT_EXPIRES_IN`, `HOLD_MINUTES_DEFAULT` | no | token lifetime and seat-hold window |
| `UPLOAD_DIR` | no | uploads folder on a mounted persistent disk |

**Uploads on a hosted API:** container filesystems are ephemeral, so uploaded banners vanish on
restart or redeploy. Attach a Render disk (mount `/var/data`) and set `UPLOAD_DIR=/var/data/uploads`,
or move the upload to object storage.

### Submission checklist
The report/PPT must list the live frontend URL, the API base URL (`https://…/api/v1`) and the GitHub
repository, plus one login per role:
`admin@stagepass.test / Admin@123` · `organizer@stagepass.test / Organizer@123` ·
`customer@stagepass.test / Customer@123` · `scanner@stagepass.test / Scanner@123`.

---

## 🧪 Testing

- `npm run e2e` — 24 assertions over auth, RBAC, holds, checkout, price snapshot, QR uniqueness, single-scan rule, cancellation + refunds, audit trail.
- `npm run typecheck` / `npm run build` — TypeScript and production build.
- Manual API checks with Postman work against `http://localhost:4000/api/v1` using `Authorization: Bearer <token>` or the login cookie.

## 📚 Docs

- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — architecture, schema, phases
- [`DESIGN.md`](./DESIGN.md) — colour system, typography, component specs
- [`database/schema.sql`](./database/schema.sql) — complete PostgreSQL schema
- [`render.yaml`](./render.yaml) · [`Dockerfile`](./Dockerfile) — API + PostgreSQL hosting config
