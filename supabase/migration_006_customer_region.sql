-- ============================================================
--  Migration 006 — Add region column to customers
--
--  Enables grouping customers by Thai region for analytics,
--  geo-targeted campaigns, and lookalike audiences.
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS region TEXT;

COMMENT ON COLUMN public.customers.region IS
  'Thai region of the customer: bangkok_metro | central | eastern | northern | northeastern | western | southern | international';
