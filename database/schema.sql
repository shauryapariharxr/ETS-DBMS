-- StagePass — complete PostgreSQL schema (single file, for submission/import).
-- Generated from the ordered migrations in src/db/migrations; applying this file to
-- an empty database produces exactly the schema the API expects.

-- ===== 001_init.sql =====
-- StagePass schema. Business-rule enforcement notes:
-- Rule 1  events.venue_id NOT NULL FK + CHECK(ends_at > starts_at)
-- Rule 2  seats UNIQUE(venue_id, section, row_label, seat_number)
-- Rule 3  tickets UNIQUE(event_id, seat_id) -- stricter than a partial index: a seat is
--         blocked the moment a pending ticket exists; the sweeper cancels stale pendings.
-- Rule 4  tickets stores base_price/tax_amount/fee_amount/total_price snapshots at purchase
-- Rule 5  tickets.status starts 'pending'; flips 'active' only in the payment transaction
-- Rule 6  tickets.ticket_number UNIQUE + tickets.qr_code UNIQUE
-- Rule 7  scans + events.reentry_allowed; scan service rejects a 2nd granted scan unless allowed
-- Rule 8  events.status 'cancelled' gates sales; cancelEvent creates refunds rows
-- Rule 9  seat_holds.expires_at; node-cron sweeper releases them
-- Rule 10 audit_logs is append-only (no UPDATE/DELETE paths in the app)

BEGIN;

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','organizer','admin','scanner')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  address  TEXT NOT NULL,
  city     TEXT NOT NULL,
  capacity INT  NOT NULL CHECK (capacity > 0)
);

CREATE TABLE seats (
  id          BIGSERIAL PRIMARY KEY,
  venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  row_label   TEXT NOT NULL,
  seat_number INT  NOT NULL CHECK (seat_number > 0),
  tier_name   TEXT NOT NULL DEFAULT 'Standard',
  UNIQUE (venue_id, section, row_label, seat_number)  -- Rule 2
);
CREATE INDEX seats_venue_idx ON seats(venue_id);

CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,
  venue_id        BIGINT NOT NULL REFERENCES venues(id),  -- Rule 1
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'Music',
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','cancelled','completed')),
  reentry_allowed BOOLEAN NOT NULL DEFAULT FALSE,          -- Rule 7
  entry_gate      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at) -- Rule 1
);
CREATE INDEX events_starts_idx ON events(starts_at);
CREATE INDEX events_status_idx ON events(status);

CREATE TABLE ticket_tiers (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  base_price  NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  tax_rate    NUMERIC(5,4)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  fee_amount  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  quantity    INT NOT NULL CHECK (quantity > 0),
  sales_start TIMESTAMPTZ,
  sales_end   TIMESTAMPTZ,
  UNIQUE (event_id, name)
);
CREATE INDEX tiers_event_idx ON ticket_tiers(event_id);

CREATE TABLE seat_holds (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id    BIGINT NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, seat_id)                                -- one live hold per seat/event
);
CREATE INDEX seat_holds_expiry_idx ON seat_holds(expires_at);

CREATE TABLE tickets (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES events(id),
  seat_id       BIGINT NOT NULL REFERENCES seats(id),
  tier_id       BIGINT NOT NULL REFERENCES ticket_tiers(id),
  user_id       BIGINT NOT NULL REFERENCES users(id),
  ticket_number TEXT NOT NULL UNIQUE,                       -- Rule 6
  qr_code       TEXT NOT NULL UNIQUE,                       -- Rule 6
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','used','cancelled')),
  base_price    NUMERIC(10,2) NOT NULL,                     -- Rule 4 snapshot
  tax_amount    NUMERIC(10,2) NOT NULL,
  fee_amount    NUMERIC(10,2) NOT NULL,
  total_price   NUMERIC(10,2) NOT NULL,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tickets_unique_seat_per_event UNIQUE (event_id, seat_id)  -- Rule 3
);
CREATE INDEX tickets_user_idx ON tickets(user_id);
CREATE INDEX tickets_event_idx ON tickets(event_id);

CREATE TABLE payments (
  id           BIGSERIAL PRIMARY KEY,
  ticket_id    BIGINT NOT NULL REFERENCES tickets(id),
  user_id      BIGINT NOT NULL REFERENCES users(id),
  method       TEXT NOT NULL CHECK (method IN ('card','upi','comp')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  tax_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  provider_ref TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_ticket_idx ON payments(ticket_id);

CREATE TABLE scans (
  id         BIGSERIAL PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES tickets(id),
  gate_id    TEXT NOT NULL,
  scanned_by BIGINT REFERENCES users(id),
  result     TEXT NOT NULL CHECK (result IN ('granted','denied')),
  reason     TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scans_ticket_idx ON scans(ticket_id, scanned_at);

CREATE TABLE refunds (
  id         BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id),
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','processed','failed')),
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (                                   -- Rule 10
  id          BIGSERIAL PRIMARY KEY,
  actor_id    BIGINT REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   BIGINT,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx  ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_created_idx ON audit_logs(created_at);

COMMIT;

-- ===== 002_partial_unique.sql =====
-- Rule 3 refinement: only LIVE tickets (pending/active/used) block a seat.
-- Cancelled tickets stop blocking so failed/cancelled purchases free the seat,
-- while the ticket and payment rows remain for audit (Rule 10).
ALTER TABLE tickets DROP CONSTRAINT tickets_unique_seat_per_event;

CREATE UNIQUE INDEX tickets_event_seat_live_idx
  ON tickets (event_id, seat_id)
  WHERE status IN ('pending', 'active', 'used');

-- ===== 003_scans_nullable.sql =====
-- Unknown QR codes must still be audit-logged (Rule 10), so scans.ticket_id becomes nullable.
ALTER TABLE scans ALTER COLUMN ticket_id DROP NOT NULL;

-- ===== 004_event_banner.sql =====
-- File upload feature: an event can show a banner image uploaded through the API (multer).
ALTER TABLE events ADD COLUMN banner_url TEXT;

-- ===== 005_remove_demo_data.sql =====
-- Production cleanup: remove the demo catalogue and demo accounts that earlier
-- versions of the seed script installed on every fresh database.
--
-- Runs once (tracked in schema_migrations) and is a no-op on a database that
-- never had demo data. The schema itself is untouched, so events, venues and
-- customers can be created normally afterwards.

TRUNCATE TABLE
  refunds,
  scans,
  payments,
  seat_holds,
  tickets,
  audit_logs,
  ticket_tiers,
  events,
  seats,
  venues
  RESTART IDENTITY CASCADE;

DELETE FROM users
 WHERE email IN (
   'admin@stagepass.test',
   'customer@stagepass.test',
   'scanner@stagepass.test',
   'organizer@stagepass.test',
   'test.visitor+buffy@example.com'
 );

