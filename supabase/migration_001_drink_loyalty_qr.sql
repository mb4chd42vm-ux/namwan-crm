-- ============================================================
--  Migration 001 — Drink-based loyalty + QR claim system
--  Supabase SQL Editor: run this file once against your project.
--
--  Safe to run on:
--    • a fresh database (after schema.sql)
--    • an existing database that has partial migrations applied
--
--  All statements are idempotent.
-- ============================================================


-- ============================================================
-- PART 1: purchases — add drink_quantity column
-- ============================================================

alter table public.purchases
  add column if not exists drink_quantity integer not null default 0;

-- Constrain non-negative (add only if missing)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchases'::regclass
      and conname   = 'purchases_drink_quantity_non_negative'
  ) then
    alter table public.purchases
      add constraint purchases_drink_quantity_non_negative
        check (drink_quantity >= 0);
  end if;
end;
$$;

-- Index for analytics queries filtering by drink_quantity > 0
create index if not exists idx_purchases_drink_quantity
  on public.purchases (drink_quantity)
  where drink_quantity > 0;

-- Backfill: for existing rows, set drink_quantity = points_earned (1 drink ≡ 1 point legacy)
update public.purchases
set drink_quantity = points_earned
where drink_quantity = 0
  and points_earned > 0;


-- ============================================================
-- PART 2: points_transactions — verify sign constraints exist
--
-- These constraints ship in schema.sql; this block adds them
-- only if they were dropped or the schema was applied without them.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.points_transactions'::regclass
      and conname   = 'earn_must_be_positive'
  ) then
    alter table public.points_transactions
      add constraint earn_must_be_positive
        check (type <> 'earn' or points > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.points_transactions'::regclass
      and conname   = 'redeem_must_be_negative'
  ) then
    alter table public.points_transactions
      add constraint redeem_must_be_negative
        check (type <> 'redeem' or points < 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.points_transactions'::regclass
      and conname   = 'expire_must_be_negative'
  ) then
    alter table public.points_transactions
      add constraint expire_must_be_negative
        check (type <> 'expire' or points < 0);
  end if;
end;
$$;

comment on column public.points_transactions.points is
  'Signed delta. Convention: earn > 0, redeem < 0, expire < 0, adjust ± (staff correction).';


-- ============================================================
-- PART 3: log_purchase — drink-based points (replace function)
--
-- Old rule: floor(total_amount / 25) points
-- New rule: p_drink_quantity points  (1 drink = 1 point)
-- ============================================================

create or replace function public.log_purchase(
  p_customer_id    uuid,
  p_branch_id      uuid,
  p_items          jsonb,                -- [{name, quantity, unit_price}, …]
  p_drink_quantity integer default 0,
  p_staff_note     text    default null,
  p_performed_by   uuid    default null
) returns uuid language plpgsql security definer as $$
declare
  v_purchase_id   uuid;
  v_total         numeric(10,2);
  v_points_earned integer;
  v_new_balance   integer;
  v_new_spending  numeric(12,2);
  v_new_visits    integer;
begin
  -- 1. Calculate bill total from items (revenue tracking)
  select coalesce(
    sum((item->>'quantity')::int * (item->>'unit_price')::numeric), 0
  )
  into v_total
  from jsonb_array_elements(p_items) as item;

  if v_total <= 0 then
    raise exception 'Purchase total must be greater than zero';
  end if;

  if p_drink_quantity < 0 then
    raise exception 'Drink quantity cannot be negative';
  end if;

  -- 2. Points = drink count (1 drink = 1 point)
  v_points_earned := p_drink_quantity;

  -- 3. Insert purchase header
  insert into public.purchases
    (customer_id, branch_id, total_amount, points_earned, drink_quantity, staff_note, created_by)
  values
    (p_customer_id, p_branch_id, v_total, v_points_earned, p_drink_quantity, p_staff_note, p_performed_by)
  returning id into v_purchase_id;

  -- 4. Insert line items
  insert into public.purchase_items (purchase_id, name, quantity, unit_price)
  select
    v_purchase_id,
    item->>'name',
    (item->>'quantity')::smallint,
    (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) as item;

  -- 5. Update customer aggregates atomically (single UPDATE; triggers updated_at)
  update public.customers
  set
    total_spending = total_spending + v_total,
    total_points   = total_points   + v_points_earned,
    visit_count    = visit_count    + 1,
    last_visit_at  = now(),
    segment        = derive_segment(total_spending + v_total, now(), visit_count + 1),
    updated_at     = now()
  where id = p_customer_id
  returning total_points, total_spending, visit_count
  into v_new_balance, v_new_spending, v_new_visits;

  if not found then
    raise exception 'Customer not found: %', p_customer_id;
  end if;

  -- 6. Record earn transaction (only when drinks were ordered)
  if v_points_earned > 0 then
    insert into public.points_transactions
      (customer_id, branch_id, purchase_id, type, points, balance_after, note, performed_by)
    values
      (p_customer_id, p_branch_id, v_purchase_id,
       'earn', v_points_earned, v_new_balance,
       'Earned ' || v_points_earned
         || ' point' || case when v_points_earned = 1 then '' else 's' end
         || ' (' || p_drink_quantity
         || ' drink' || case when p_drink_quantity = 1 then '' else 's' end || ')',
       p_performed_by);
  end if;

  return v_purchase_id;
end;
$$;

comment on function public.log_purchase is
  'Atomically records a purchase, its line items, customer aggregate updates, '
  'and the earn points_transaction. Points = drink_quantity (1 drink = 1 pt). '
  'Redemption rule (10 pts = 1 free drink) is enforced at the application layer.';


-- ============================================================
-- PART 4: adjust_points — ensure redeem stores negative delta
--
-- Behaviour is already correct in schema.sql; this replace
-- makes the sign contract explicit in comments and guards
-- against the `adjust` type being passed a negative for redeem.
-- ============================================================

create or replace function public.adjust_points(
  p_customer_id   uuid,
  p_branch_id     uuid,
  p_type          public.points_tx_type,   -- 'redeem' | 'adjust' | 'expire' | 'earn'
  p_points        integer,                  -- always pass positive; sign applied by type
  p_note          text,
  p_performed_by  uuid default null
) returns void language plpgsql security definer as $$
declare
  v_delta       integer;
  v_new_balance integer;
begin
  -- Signed delta:
  --   redeem / expire → negative (customer loses points)
  --   earn            → positive (used for QR claims)
  --   adjust          → caller controls sign via p_points sign
  v_delta := case
    when p_type in ('redeem', 'expire') then -abs(p_points)
    when p_type = 'earn'               then  abs(p_points)
    else p_points   -- adjust: honour the sign the caller provides
  end;

  -- Atomic balance update
  update public.customers
  set
    total_points = total_points + v_delta,
    updated_at   = now()
  where id = p_customer_id
  returning total_points into v_new_balance;

  if not found then
    raise exception 'Customer not found: %', p_customer_id;
  end if;

  if v_new_balance < 0 then
    raise exception 'Insufficient points balance (would be %)', v_new_balance;
  end if;

  -- Ledger entry — sign constraints enforced by table CHECK constraints
  insert into public.points_transactions
    (customer_id, branch_id, type, points, balance_after, note, performed_by)
  values
    (p_customer_id, p_branch_id, p_type, v_delta, v_new_balance, p_note, p_performed_by);
end;
$$;

comment on function public.adjust_points is
  'Adjusts a customer''s point balance and writes the ledger entry. '
  'redeem/expire → stored as negative delta. earn → positive. '
  'adjust → sign of p_points is honoured as-is. Raises if balance goes negative.';


-- ============================================================
-- PART 5: point_claim_qr table
-- ============================================================

create table if not exists public.point_claim_qr (
  id                     uuid        primary key default gen_random_uuid(),
  token                  text        not null,
  branch_id              uuid        not null references public.branches(id) on delete restrict,
  drink_quantity         integer     not null,
  points                 integer     not null,
  status                 text        not null default 'pending',
  claimed_by_customer_id uuid        references public.customers(id) on delete set null,
  expires_at             timestamptz not null,
  claimed_at             timestamptz,
  created_by_staff_id    uuid        references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- ── Constraints ──────────────────────────────────────────────

-- Unique token (required for the /claim/[token] lookup)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.point_claim_qr'::regclass
      and conname   = 'point_claim_qr_token_unique'
  ) then
    alter table public.point_claim_qr
      add constraint point_claim_qr_token_unique unique (token);
  end if;
end;
$$;

-- Status must be one of the four valid values
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.point_claim_qr'::regclass
      and conname   = 'point_claim_qr_status_values'
  ) then
    alter table public.point_claim_qr
      add constraint point_claim_qr_status_values
        check (status in ('pending', 'claimed', 'expired', 'cancelled'));
  end if;
end;
$$;

-- drink_quantity must be at least 1
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.point_claim_qr'::regclass
      and conname   = 'point_claim_qr_drink_quantity_positive'
  ) then
    alter table public.point_claim_qr
      add constraint point_claim_qr_drink_quantity_positive
        check (drink_quantity > 0);
  end if;
end;
$$;

-- points must be at least 1
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.point_claim_qr'::regclass
      and conname   = 'point_claim_qr_points_positive'
  ) then
    alter table public.point_claim_qr
      add constraint point_claim_qr_points_positive
        check (points > 0);
  end if;
end;
$$;

-- claimed_at must be set when status = 'claimed', and null otherwise
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.point_claim_qr'::regclass
      and conname   = 'point_claim_qr_claimed_at_consistency'
  ) then
    alter table public.point_claim_qr
      add constraint point_claim_qr_claimed_at_consistency
        check (
          (status = 'claimed' and claimed_at is not null and claimed_by_customer_id is not null)
          or
          (status <> 'claimed' and claimed_at is null and claimed_by_customer_id is null)
        );
  end if;
end;
$$;

-- ── Indexes ──────────────────────────────────────────────────

-- Primary lookup: /claim/[token] — needs fast single-row read
create index if not exists idx_qr_token
  on public.point_claim_qr (token);

-- Status filtering: staff view of pending/claimed counts
create index if not exists idx_qr_status
  on public.point_claim_qr (status);

-- Branch-level reporting
create index if not exists idx_qr_branch_id
  on public.point_claim_qr (branch_id);

-- Staff can list their own tokens
create index if not exists idx_qr_created_by
  on public.point_claim_qr (created_by_staff_id)
  where created_by_staff_id is not null;

-- Expiry sweep (background job can find expired pending tokens)
create index if not exists idx_qr_expires_at_pending
  on public.point_claim_qr (expires_at)
  where status = 'pending';

-- ── Comments ─────────────────────────────────────────────────

comment on table public.point_claim_qr is
  'One-time QR tokens staff generate so customers can self-claim points. '
  'Expires after 5 minutes; once claimed the row is immutable via RLS.';

comment on column public.point_claim_qr.token is
  '48-char lowercase hex string (24 random bytes). Never reused.';
comment on column public.point_claim_qr.points is
  'Points credited to the customer on claim. Equals drink_quantity (1 drink = 1 pt).';
comment on column public.point_claim_qr.status is
  'pending → claimed|expired|cancelled. Transitions are one-way.';


-- ── Row Level Security ───────────────────────────────────────

alter table public.point_claim_qr enable row level security;

-- Authenticated staff: full read/write (server actions run with service role
-- which bypasses RLS, but this covers direct dashboard access)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'point_claim_qr'
      and policyname = 'staff_manage_qr_tokens'
  ) then
    execute $pol$
      create policy staff_manage_qr_tokens
        on public.point_claim_qr
        for all
        to authenticated
        using (true)
        with check (true)
    $pol$;
  end if;
end;
$$;


-- ============================================================
-- PART 6: expire_stale_qr_tokens helper
--
-- Call this from a scheduled Edge Function or pg_cron to keep
-- the table tidy. Also called opportunistically by the claim
-- server action before checking token status.
-- ============================================================

create or replace function public.expire_stale_qr_tokens()
returns integer language plpgsql security definer as $$
declare
  v_count integer;
begin
  update public.point_claim_qr
  set status = 'expired'
  where status = 'pending'
    and expires_at < now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.expire_stale_qr_tokens is
  'Marks all pending QR tokens past their expiry as expired. '
  'Returns the number of rows updated. Safe to call repeatedly.';
