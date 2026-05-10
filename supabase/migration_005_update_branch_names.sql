-- ============================================================
--  Migration 005 — Update branch names to Namwan branding
--
--  Preserves existing UUIDs so all historical purchases,
--  points_transactions, redeem_requests, and customers
--  that reference these branch_ids remain valid.
--
--  Run this once in Supabase SQL Editor.
-- ============================================================

UPDATE public.branches
SET
  name       = 'Namwan Muengthongthani',
  location   = 'Muengthongthani, Nonthaburi',
  updated_at = now()
WHERE id = 'b1000000-0000-0000-0000-000000000001';

UPDATE public.branches
SET
  name       = 'Namwan Petchkasem',
  location   = 'Petchkasem Road, Bangkok',
  updated_at = now()
WHERE id = 'b1000000-0000-0000-0000-000000000002';

UPDATE public.branches
SET
  name       = 'Namwan Bake Beforebrunch (Suan Phak)',
  location   = 'Suan Phak, Bangkok',
  updated_at = now()
WHERE id = 'b1000000-0000-0000-0000-000000000003';
