-- ============================================================
--  Migration 004 — Two-step redeem requests + extended customer profile
--  Supabase SQL Editor: run this file once against your project.
--  All statements are idempotent.
-- ============================================================


-- ============================================================
-- PART 1: customers — extended onboarding fields
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS gender              TEXT,
  ADD COLUMN IF NOT EXISTS area_or_province    TEXT,
  ADD COLUMN IF NOT EXISTS favorite_branch_id  UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discovered_from     TEXT,
  ADD COLUMN IF NOT EXISTS marketing_consent   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.gender             IS 'Optional: male | female | other | prefer_not_to_say';
COMMENT ON COLUMN public.customers.area_or_province   IS 'Customer''s area or province for regional analytics';
COMMENT ON COLUMN public.customers.favorite_branch_id IS 'Customer''s preferred branch (set during onboarding)';
COMMENT ON COLUMN public.customers.discovered_from    IS 'How the customer heard about Namwan (social_media | friend | walk_in | other)';
COMMENT ON COLUMN public.customers.marketing_consent  IS 'Whether customer consented to marketing messages';
COMMENT ON COLUMN public.customers.profile_completed  IS 'True once the full onboarding form has been submitted';


-- ============================================================
-- PART 2: redeem_requests table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.redeem_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                TEXT        NOT NULL,
  customer_id          UUID        NOT NULL REFERENCES public.customers(id)  ON DELETE CASCADE,
  line_id              TEXT        NOT NULL,
  reward_name          TEXT        NOT NULL DEFAULT '1 Free Drink',
  points_required      INTEGER     NOT NULL DEFAULT 10,
  status               TEXT        NOT NULL DEFAULT 'pending',
  branch_id            UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
  confirmed_by_staff_id UUID       REFERENCES auth.users(id)      ON DELETE SET NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  confirmed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.redeem_requests'::regclass
      AND conname   = 'redeem_requests_token_unique'
  ) THEN
    ALTER TABLE public.redeem_requests
      ADD CONSTRAINT redeem_requests_token_unique UNIQUE (token);
  END IF;
END;
$$;

-- Status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.redeem_requests'::regclass
      AND conname   = 'redeem_requests_status_values'
  ) THEN
    ALTER TABLE public.redeem_requests
      ADD CONSTRAINT redeem_requests_status_values
        CHECK (status IN ('pending', 'completed', 'expired', 'cancelled'));
  END IF;
END;
$$;

-- Points required must be positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.redeem_requests'::regclass
      AND conname   = 'redeem_requests_points_positive'
  ) THEN
    ALTER TABLE public.redeem_requests
      ADD CONSTRAINT redeem_requests_points_positive
        CHECK (points_required > 0);
  END IF;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_redeem_requests_token
  ON public.redeem_requests (token);

CREATE INDEX IF NOT EXISTS idx_redeem_requests_customer_id
  ON public.redeem_requests (customer_id);

CREATE INDEX IF NOT EXISTS idx_redeem_requests_status
  ON public.redeem_requests (status);

CREATE INDEX IF NOT EXISTS idx_redeem_requests_expires_pending
  ON public.redeem_requests (expires_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE public.redeem_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'redeem_requests'
      AND policyname = 'staff_manage_redeem_requests'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY staff_manage_redeem_requests
        ON public.redeem_requests
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END;
$$;

COMMENT ON TABLE  public.redeem_requests              IS 'Two-step redemption flow: customer creates request (no immediate deduction), staff scans and confirms.';
COMMENT ON COLUMN public.redeem_requests.token        IS '48-char hex token (24 random bytes) encoded in the QR shown to the customer.';
COMMENT ON COLUMN public.redeem_requests.status       IS 'pending → completed|expired|cancelled. One-way transitions.';
COMMENT ON COLUMN public.redeem_requests.points_required IS 'Points to deduct on confirmation. Currently always 10.';


-- ============================================================
-- PART 3: expire_stale_redeem_requests helper
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_stale_redeem_requests()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.redeem_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_redeem_requests IS
  'Marks all pending redeem requests past their expiry as expired. Safe to call repeatedly.';
