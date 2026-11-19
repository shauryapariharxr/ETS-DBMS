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
