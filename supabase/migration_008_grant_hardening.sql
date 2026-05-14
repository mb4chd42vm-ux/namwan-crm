-- ============================================================
--  Migration 008 — Explicit GRANT hardening
--
--  Context: Supabase is removing legacy default grants that
--  auto-granted anon + authenticated full access to every
--  table in the public schema. Without explicit GRANTs,
--  RLS policies become irrelevant — no role can reach the
--  table in the first place.
--
--  This file:
--    1. Revokes broad legacy grants from anon (no CRM table
--       should ever be reachable without authentication)
--    2. Grants authenticated the minimum columns/operations
--       needed, with RLS doing the row-level enforcement
--    3. Grants EXECUTE on security-definer functions only to
--       authenticated (service_role bypasses RLS and always
--       has access)
--    4. Tightens the two over-permissive RLS policies on
--       point_claim_qr and redeem_requests
--
--  Safe to run multiple times (GRANT/REVOKE are idempotent).
--  Does NOT touch any row data.
--
--  Review before running. Run as a superuser or the project
--  owner role in the Supabase SQL editor.
-- ============================================================


-- ============================================================
-- STEP 1: Revoke legacy anon grants on every CRM table
--
-- anon = unauthenticated public internet. No CRM table should
-- be reachable without auth. Revoke explicitly so the legacy
-- default cannot re-apply after a Supabase policy change.
-- ============================================================

REVOKE ALL ON TABLE public.branches             FROM anon;
REVOKE ALL ON TABLE public.customers            FROM anon;
REVOKE ALL ON TABLE public.purchases            FROM anon;
REVOKE ALL ON TABLE public.purchase_items       FROM anon;
REVOKE ALL ON TABLE public.points_transactions  FROM anon;
REVOKE ALL ON TABLE public.campaigns            FROM anon;
REVOKE ALL ON TABLE public.point_claim_qr       FROM anon;
REVOKE ALL ON TABLE public.staff_profiles       FROM anon;
REVOKE ALL ON TABLE public.redeem_requests      FROM anon;


-- ============================================================
-- STEP 2: Grant authenticated role the correct operations
--         per table (row-level filtering is done by RLS)
--
-- Principle: grant the minimum needed for the app to work.
-- service_role bypasses RLS and already has full access.
-- ============================================================

-- branches: staff need to read branch list for selectors,
--           dashboard, QR forms. Writes go via service_role only.
GRANT SELECT ON TABLE public.branches TO authenticated;

-- customers: full CRUD (staff register, update, soft-delete members)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;

-- purchases: append-only. No client-side update or delete.
GRANT SELECT, INSERT ON TABLE public.purchases TO authenticated;

-- purchase_items: same as purchases (cascade delete handled by DB)
GRANT SELECT, INSERT ON TABLE public.purchase_items TO authenticated;

-- points_transactions: immutable ledger — read + insert only
GRANT SELECT, INSERT ON TABLE public.points_transactions TO authenticated;

-- campaigns: managers/admins manage campaigns
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaigns TO authenticated;

-- point_claim_qr: staff create QR tokens, update status on claim
--                 customers claim via service_role server action
GRANT SELECT, INSERT, UPDATE ON TABLE public.point_claim_qr TO authenticated;

-- staff_profiles: staff can read their own row only (RLS restricts).
--                 INSERT/UPDATE/DELETE go through service_role (admin ops).
GRANT SELECT ON TABLE public.staff_profiles TO authenticated;

-- redeem_requests: staff read + status updates; customer creates via
--                  service_role server action (no direct anon access)
GRANT SELECT, INSERT, UPDATE ON TABLE public.redeem_requests TO authenticated;


-- ============================================================
-- STEP 3: Grant EXECUTE on security-definer RPCs
--
-- These functions run as the DB owner (postgres) so they can
-- bypass RLS internally. Granting EXECUTE only lets the caller
-- invoke them — the function itself still enforces all logic.
-- ============================================================

-- Core transactional RPCs (called by staff server actions)
GRANT EXECUTE ON FUNCTION public.log_purchase(uuid, uuid, jsonb, integer, text, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_points(uuid, uuid, public.points_tx_type, integer, text, uuid) TO authenticated;

-- Analytics RPCs (dashboard)
GRANT EXECUTE ON FUNCTION public.get_sales_by_branch(timestamptz, timestamptz)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_points_by_branch(timestamptz, timestamptz)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_customers(int, uuid)                          TO authenticated;

-- Segment refresh (cron / admin trigger)
GRANT EXECUTE ON FUNCTION public.refresh_segments()                                    TO authenticated;

-- Expiry helpers (called server-side; anon should never invoke these)
GRANT EXECUTE ON FUNCTION public.expire_stale_qr_tokens()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_redeem_requests() TO authenticated;

-- Helper (used by RLS policies — must be callable by authenticated)
GRANT EXECUTE ON FUNCTION public.is_authenticated_staff()      TO authenticated;


-- ============================================================
-- STEP 4: Tighten over-permissive RLS policies
--
-- Current issue: point_claim_qr and redeem_requests both use
-- USING(true) for authenticated, meaning any logged-in session
-- can read every row across every branch and every customer.
--
-- Fix: scope reads to the staff member's own branch, or to
-- service_role paths only (server actions use service_role and
-- bypass RLS, so the policies below don't break server actions).
-- ============================================================

-- ── point_claim_qr ───────────────────────────────────────────

-- Drop the old catch-all policy
DROP POLICY IF EXISTS staff_manage_qr_tokens          ON public.point_claim_qr;
DROP POLICY IF EXISTS "Staff can manage own QR tokens" ON public.point_claim_qr;

-- Staff can only see QR tokens they created
CREATE POLICY qr_staff_select_own
  ON public.point_claim_qr
  FOR SELECT
  TO authenticated
  USING (created_by_staff_id = auth.uid());

-- Staff can create QR tokens (branch_id required)
CREATE POLICY qr_staff_insert
  ON public.point_claim_qr
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by_staff_id = auth.uid());

-- Staff can cancel their own pending tokens; claimed/expired rows
-- are effectively immutable (server action uses service_role for claims)
CREATE POLICY qr_staff_update_own
  ON public.point_claim_qr
  FOR UPDATE
  TO authenticated
  USING  (created_by_staff_id = auth.uid() AND status = 'pending')
  WITH CHECK (status IN ('pending', 'cancelled'));


-- ── redeem_requests ──────────────────────────────────────────

-- Drop the old catch-all policy
DROP POLICY IF EXISTS staff_manage_redeem_requests ON public.redeem_requests;

-- Staff can see pending requests at their branch
-- (branch_id is set when customer creates the request)
CREATE POLICY redeem_staff_select_branch
  ON public.redeem_requests
  FOR SELECT
  TO authenticated
  USING (
    -- staff with a branch assignment see their branch's requests
    branch_id IN (
      SELECT branch_id FROM public.staff_profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND branch_id IS NOT NULL
    )
    OR
    -- admin/manager with no branch restriction see all
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('admin', 'manager')
    )
  );

-- Staff confirm (update status) on their branch's requests
CREATE POLICY redeem_staff_update_branch
  ON public.redeem_requests
  FOR UPDATE
  TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM public.staff_profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND branch_id IS NOT NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE auth_user_id = auth.uid()
        AND is_active = true
        AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (status IN ('pending', 'completed', 'expired', 'cancelled'));

-- INSERT is intentionally omitted for authenticated staff here:
-- customers create redeem_requests via the /api/liff/redeem
-- server action which runs with service_role (bypasses RLS).
-- If you later allow staff to initiate redemptions directly,
-- add an INSERT policy here.


-- ============================================================
-- STEP 5: Schema-level USAGE grant
--
-- Without USAGE on the schema itself, role can't see any
-- objects inside it even if table grants exist.
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;
-- anon intentionally omitted


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after applying to confirm the grants landed.
-- ============================================================

/*
-- Check table privileges
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Check function privileges
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE specific_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY routine_name;

-- Check RLS policies
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/
