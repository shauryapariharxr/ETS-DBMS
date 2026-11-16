-- ============================================================================
-- StagePass — Event Ticketing & Seating
-- PostgreSQL schema (single-file import for the project report / fresh database)
-- Generated from src/db/migrations; run `npm run db:migrate` for the app itself.
--
-- 10 related tables: users, venues, seats, events, ticket_tiers, seat_holds,
--                    tickets, payments, scans, refunds, audit_logs
-- Primary keys, foreign keys, CHECK constraints and a partial unique index
-- enforce the 10 business rules described in README.md.
-- ============================================================================

BEGIN;

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                       -- bcrypt hash, never plain text
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
  UNIQUE (venue_id, section, row_label, seat_number)   -- Rule 2
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
  banner_url      TEXT,                                    -- uploaded via multer
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at)  -- Rule 1
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
  UNIQUE (event_id, seat_id)                               -- Rule 9
);
CREATE INDEX seat_holds_expiry_idx ON seat_holds(expires_at);

CREATE TABLE tickets (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES events(id),
  seat_id       BIGINT NOT NULL REFERENCES seats(id),
  tier_id       BIGINT NOT NULL REFERENCES ticket_tiers(id),
  user_id       BIGINT NOT NULL REFERENCES users(id),
  ticket_number TEXT NOT NULL UNIQUE,                      -- Rule 6
  qr_code       TEXT NOT NULL UNIQUE,                      -- Rule 6
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','used','cancelled')),
  base_price    NUMERIC(10,2) NOT NULL,                    -- Rule 4 snapshot
  tax_amount    NUMERIC(10,2) NOT NULL,
  fee_amount    NUMERIC(10,2) NOT NULL,
  total_price   NUMERIC(10,2) NOT NULL,
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tickets_user_idx  ON tickets(user_id);
CREATE INDEX tickets_event_idx ON tickets(event_id);

-- Rule 3: only live tickets block a seat, so cancelled sales free the seat
-- while the ticket/payment rows stay for the audit trail.
CREATE UNIQUE INDEX tickets_event_seat_live_idx
  ON tickets (event_id, seat_id)
  WHERE status IN ('pending', 'active', 'used');

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
  ticket_id  BIGINT REFERENCES tickets(id),   -- nullable: unknown codes are logged too
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

CREATE TABLE audit_logs (                      -- Rule 10 (append-only)
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

-- Sample JOIN query used by the storefront (requirement: at least one JOIN).
-- SELECT e.id, e.title, v.name AS venue, v.city
-- FROM events e JOIN venues v ON v.id = e.venue_id
-- WHERE e.status = 'scheduled' ORDER BY e.starts_at;
