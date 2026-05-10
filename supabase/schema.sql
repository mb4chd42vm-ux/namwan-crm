-- ============================================================
-- Brew & Co — Multi-Branch Bakery CRM
-- Supabase / PostgreSQL Schema
-- ============================================================
-- Run order:
--   1. Extensions
--   2. Enums
--   3. Tables
--   4. Indexes
--   5. Functions & Triggers
--   6. Row Level Security
--   7. Seed Data
-- ============================================================


-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ============================================================
-- 2. ENUM TYPES
-- ============================================================

create type customer_segment as enum (
  'new',        -- 0 purchases
  'returning',  -- 1+ purchases, active within 90 days
  'vip',        -- lifetime spending >= 10,000 THB
  'inactive'    -- no visit in 90+ days
);

create type points_tx_type as enum (
  'earn',    -- auto-created on purchase
  'redeem',  -- customer uses points
  'adjust',  -- manual staff correction
  'expire'   -- points expiry
);

create type campaign_status as enum ('draft', 'active', 'ended');

create type campaign_segment as enum ('all', 'new', 'returning', 'vip', 'inactive');


-- ============================================================
-- 3. TABLES
-- ============================================================

-- ── branches ─────────────────────────────────────────────────
create table branches (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  location    text,
  phone       text,
  color_hex   text        not null default '#c45f12',  -- UI accent colour
  sort_order  smallint    not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table branches is
  'Physical locations. Customers share one membership across all branches.';


-- ── customers ────────────────────────────────────────────────
create table customers (
  id                  uuid           primary key default uuid_generate_v4(),
  name                text           not null,
  phone               text           not null unique,
  line_id             text           unique,
  birthday            date,
  notes               text,

  -- Aggregates (updated by trigger on every purchase / points tx)
  total_points        integer        not null default 0
                        check (total_points >= 0),
  total_spending      numeric(12,2)  not null default 0
                        check (total_spending >= 0),
  visit_count         integer        not null default 0
                        check (visit_count >= 0),
  last_visit_at       timestamptz,

  -- Segment is derived and cached here for fast queries / filtering
  segment             customer_segment not null default 'new',

  -- The branch this customer "belongs to" (where they signed up)
  home_branch_id      uuid           references branches(id) on delete set null,

  is_active           boolean        not null default true,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);

comment on table customers is
  'Members of the loyalty programme. One account, valid at all branches.';
comment on column customers.total_points    is 'Live point balance — updated atomically by adjust_points().';
comment on column customers.total_spending  is 'Lifetime THB spend — updated atomically by log_purchase().';
comment on column customers.segment         is 'Cached segment; refreshed on every purchase and by refresh_segments().';


-- ── purchases ────────────────────────────────────────────────
create table purchases (
  id             uuid           primary key default uuid_generate_v4(),

  -- Every purchase must know which customer and which branch
  customer_id    uuid           not null references customers(id) on delete restrict,
  branch_id      uuid           not null references branches(id)  on delete restrict,

  purchased_at   timestamptz    not null default now(),
  total_amount   numeric(10,2)  not null check (total_amount > 0),

  -- Points calculation: floor(total_amount / 25)
  points_earned  integer        not null default 0 check (points_earned >= 0),

  staff_note     text,
  created_by     uuid           references auth.users(id) on delete set null,
  created_at     timestamptz    not null default now()
);

comment on table purchases is
  'Each row is one bill. Line items are in purchase_items.';
comment on column purchases.branch_id is
  'Branch where the purchase was made — required for per-branch analytics.';


-- ── purchase_items ───────────────────────────────────────────
create table purchase_items (
  id           uuid           primary key default uuid_generate_v4(),
  purchase_id  uuid           not null references purchases(id) on delete cascade,
  name         text           not null,
  quantity     smallint       not null default 1 check (quantity > 0),
  unit_price   numeric(10,2)  not null check (unit_price >= 0),
  subtotal     numeric(10,2)  generated always as (quantity * unit_price) stored
);

comment on table purchase_items is 'Line items belonging to a purchase.';
comment on column purchase_items.subtotal is 'Computed: quantity × unit_price.';


-- ── points_transactions ──────────────────────────────────────
create table points_transactions (
  id             uuid                primary key default uuid_generate_v4(),
  customer_id    uuid                not null references customers(id) on delete restrict,

  -- Branch that originated the transaction (null only for system expiry jobs)
  branch_id      uuid                references branches(id) on delete set null,

  -- Linked purchase when type = 'earn'
  purchase_id    uuid                references purchases(id) on delete set null,

  type           points_tx_type      not null,

  -- Positive = credit, negative = debit.
  -- earn   → always positive
  -- redeem → always negative
  -- expire → always negative
  -- adjust → either sign (staff correction)
  points         integer             not null,
  balance_after  integer             not null check (balance_after >= 0),
  note           text,

  performed_by   uuid                references auth.users(id) on delete set null,
  created_at     timestamptz         not null default now(),

  -- Enforce sign conventions
  constraint earn_must_be_positive
    check (type <> 'earn'   or points > 0),
  constraint redeem_must_be_negative
    check (type <> 'redeem' or points < 0),
  constraint expire_must_be_negative
    check (type <> 'expire' or points < 0)
);

comment on table points_transactions is
  'Immutable ledger of every points movement. Balance is always recalculated from here.';
comment on column points_transactions.branch_id is
  'The branch that originated this points event — required for per-branch points reporting.';
comment on column points_transactions.points is
  'Signed delta: positive = customer gains points, negative = customer loses points.';


-- ── campaigns ────────────────────────────────────────────────
create table campaigns (
  id                uuid             primary key default uuid_generate_v4(),
  name              text             not null,
  description       text,

  -- Who to target
  target_segment    campaign_segment not null default 'all',

  -- null = all branches
  target_branch_id  uuid             references branches(id) on delete set null,

  status            campaign_status  not null default 'draft',
  starts_at         timestamptz      not null,
  ends_at           timestamptz,

  created_by        uuid             references auth.users(id) on delete set null,
  created_at        timestamptz      not null default now(),
  updated_at        timestamptz      not null default now()
);

comment on table campaigns is 'Loyalty promotions and re-engagement programmes.';


-- ============================================================
-- 4. INDEXES
-- ============================================================

-- branches
create index idx_branches_sort      on branches(sort_order);
create index idx_branches_active    on branches(is_active) where is_active = true;

-- customers
create index idx_customers_phone       on customers(phone);
create index idx_customers_line_id     on customers(line_id) where line_id is not null;
create index idx_customers_segment     on customers(segment);
create index idx_customers_last_visit  on customers(last_visit_at desc nulls last);
create index idx_customers_spending    on customers(total_spending desc);
create index idx_customers_points      on customers(total_points desc);
create index idx_customers_home_branch on customers(home_branch_id);
create index idx_customers_birthday    on customers(birthday) where birthday is not null;
-- Full-text name search
create index idx_customers_name_fts    on customers using gin(to_tsvector('simple', name));

-- purchases
create index idx_purchases_customer_id  on purchases(customer_id);
create index idx_purchases_branch_id    on purchases(branch_id);
create index idx_purchases_date         on purchases(purchased_at desc);
create index idx_purchases_cust_branch  on purchases(customer_id, branch_id);
create index idx_purchases_created_by   on purchases(created_by) where created_by is not null;

-- purchase_items
create index idx_items_purchase_id on purchase_items(purchase_id);

-- points_transactions
create index idx_points_customer_id  on points_transactions(customer_id);
create index idx_points_branch_id    on points_transactions(branch_id) where branch_id is not null;
create index idx_points_purchase_id  on points_transactions(purchase_id) where purchase_id is not null;
create index idx_points_type         on points_transactions(type);
create index idx_points_created_at   on points_transactions(created_at desc);
create index idx_points_cust_date    on points_transactions(customer_id, created_at desc);

-- campaigns
create index idx_campaigns_status   on campaigns(status);
create index idx_campaigns_segment  on campaigns(target_segment);
create index idx_campaigns_branch   on campaigns(target_branch_id) where target_branch_id is not null;
create index idx_campaigns_dates    on campaigns(starts_at, ends_at);


-- ============================================================
-- 5. FUNCTIONS & TRIGGERS
-- ============================================================

-- ── updated_at trigger ───────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_branches_updated_at
  before update on branches
  for each row execute function set_updated_at();

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

create trigger trg_campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();


-- ── derive_segment ───────────────────────────────────────────
-- Pure function: given a customer's stats, returns the correct segment.
create or replace function derive_segment(
  p_total_spending  numeric,
  p_last_visit_at   timestamptz,
  p_visit_count     integer
) returns customer_segment language plpgsql immutable as $$
begin
  -- Inactive: no visit in 90+ days (overrides spending-based segments)
  if p_last_visit_at is not null
     and p_last_visit_at < now() - interval '90 days' then
    return 'inactive';
  end if;

  -- VIP: lifetime spending >= 10,000 THB
  if p_total_spending >= 10000 then
    return 'vip';
  end if;

  -- Returning: has made at least 1 purchase
  if p_visit_count > 0 then
    return 'returning';
  end if;

  return 'new';
end;
$$;


-- ── log_purchase ─────────────────────────────────────────────
-- Atomic: inserts purchase + items, updates customer aggregates,
-- inserts the 'earn' points transaction.
-- Returns the new purchase UUID.
create or replace function log_purchase(
  p_customer_id   uuid,
  p_branch_id     uuid,
  p_items         jsonb,           -- [{name, quantity, unit_price}, ...]
  p_staff_note    text    default null,
  p_performed_by  uuid    default null
) returns uuid language plpgsql security definer as $$
declare
  v_purchase_id   uuid;
  v_total         numeric(10,2);
  v_points_earned integer;
  v_new_balance   integer;
  v_new_spending  numeric(12,2);
  v_new_visits    integer;
begin
  -- 1. Calculate bill total from items
  select coalesce(sum((item->>'quantity')::int * (item->>'unit_price')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) as item;

  if v_total <= 0 then
    raise exception 'Purchase total must be greater than zero';
  end if;

  -- 2. Points: 25 THB = 1 point
  v_points_earned := floor(v_total / 25)::integer;

  -- 3. Insert purchase header
  insert into purchases (customer_id, branch_id, total_amount, points_earned, staff_note, created_by)
  values (p_customer_id, p_branch_id, v_total, v_points_earned, p_staff_note, p_performed_by)
  returning id into v_purchase_id;

  -- 4. Insert line items
  insert into purchase_items (purchase_id, name, quantity, unit_price)
  select
    v_purchase_id,
    item->>'name',
    (item->>'quantity')::smallint,
    (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) as item;

  -- 5. Update customer aggregates
  update customers
  set
    total_spending = total_spending + v_total,
    total_points   = total_points   + v_points_earned,
    visit_count    = visit_count    + 1,
    last_visit_at  = now(),
    updated_at     = now()
  where id = p_customer_id
  returning total_points, total_spending, visit_count
  into v_new_balance, v_new_spending, v_new_visits;

  -- 6. Recalculate and cache segment
  update customers
  set segment = derive_segment(v_new_spending, now(), v_new_visits)
  where id = p_customer_id;

  -- 7. Record the earn transaction
  if v_points_earned > 0 then
    insert into points_transactions
      (customer_id, branch_id, purchase_id, type, points, balance_after, note, performed_by)
    values
      (p_customer_id, p_branch_id, v_purchase_id,
       'earn', v_points_earned, v_new_balance,
       'Points earned from purchase', p_performed_by);
  end if;

  return v_purchase_id;
end;
$$;

comment on function log_purchase is
  'Atomically logs a purchase, its line items, customer aggregate updates, and the earn points transaction.';


-- ── adjust_points ────────────────────────────────────────────
-- Handles redeem, adjust, and expire transactions.
create or replace function adjust_points(
  p_customer_id   uuid,
  p_branch_id     uuid,
  p_type          points_tx_type,  -- 'redeem' | 'adjust' | 'expire'
  p_points        integer,         -- always pass positive; sign is applied by type
  p_note          text,
  p_performed_by  uuid    default null
) returns void language plpgsql security definer as $$
declare
  v_delta       integer;
  v_new_balance integer;
begin
  -- Determine signed delta
  v_delta := case
    when p_type in ('redeem', 'expire') then -abs(p_points)
    else p_points  -- adjust: caller controls sign via p_points
  end;

  -- Update balance atomically
  update customers
  set
    total_points = total_points + v_delta,
    updated_at   = now()
  where id = p_customer_id
  returning total_points into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'Insufficient points balance (would go to %)', v_new_balance;
  end if;

  -- Insert transaction record
  insert into points_transactions
    (customer_id, branch_id, type, points, balance_after, note, performed_by)
  values
    (p_customer_id, p_branch_id, p_type, v_delta, v_new_balance, p_note, p_performed_by);
end;
$$;

comment on function adjust_points is
  'Safely adjusts a customer''s points balance and writes the ledger entry. Raises if balance goes negative.';


-- ── refresh_segments ─────────────────────────────────────────
-- Bulk-recalculates all customer segments.
-- Run periodically via pg_cron or a scheduled Supabase Edge Function.
create or replace function refresh_segments()
returns void language plpgsql security definer as $$
begin
  update customers
  set
    segment    = derive_segment(total_spending, last_visit_at, visit_count),
    updated_at = now();
end;
$$;

comment on function refresh_segments is
  'Recalculates and caches segment for every customer. Safe to run any time.';


-- ── analytics: get_sales_by_branch ───────────────────────────
create or replace function get_sales_by_branch(
  p_from timestamptz,
  p_to   timestamptz
) returns table (
  branch_id         uuid,
  branch_name       text,
  total_sales       numeric,
  order_count       bigint,
  avg_order_value   numeric
) language sql security definer stable as $$
  select
    b.id,
    b.name,
    coalesce(sum(p.total_amount), 0)    as total_sales,
    count(p.id)                         as order_count,
    coalesce(avg(p.total_amount), 0)    as avg_order_value
  from branches b
  left join purchases p
    on  p.branch_id    = b.id
    and p.purchased_at between p_from and p_to
  where b.is_active = true
  group by b.id, b.name
  order by total_sales desc;
$$;


-- ── analytics: get_points_by_branch ──────────────────────────
create or replace function get_points_by_branch(
  p_from timestamptz,
  p_to   timestamptz
) returns table (
  branch_id        uuid,
  branch_name      text,
  points_earned    bigint,
  points_redeemed  bigint,
  points_expired   bigint,
  points_adjusted  bigint
) language sql security definer stable as $$
  select
    b.id,
    b.name,
    coalesce(sum(case when t.type = 'earn'                 then  t.points  else 0 end), 0) as points_earned,
    coalesce(sum(case when t.type = 'redeem'               then -t.points  else 0 end), 0) as points_redeemed,
    coalesce(sum(case when t.type = 'expire'               then -t.points  else 0 end), 0) as points_expired,
    coalesce(sum(case when t.type = 'adjust'               then  t.points  else 0 end), 0) as points_adjusted
  from branches b
  left join points_transactions t
    on  t.branch_id  = b.id
    and t.created_at between p_from and p_to
  where b.is_active = true
  group by b.id, b.name;
$$;


-- ── analytics: get_top_customers ─────────────────────────────
create or replace function get_top_customers(
  p_limit     int  default 10,
  p_branch_id uuid default null   -- null = all branches
) returns table (
  customer_id    uuid,
  name           text,
  phone          text,
  segment        customer_segment,
  total_spending numeric,
  total_points   integer,
  visit_count    integer,
  last_visit_at  timestamptz
) language sql security definer stable as $$
  select
    c.id,
    c.name,
    c.phone,
    c.segment,
    c.total_spending,
    c.total_points,
    c.visit_count,
    c.last_visit_at
  from customers c
  where c.is_active = true
    and (
      p_branch_id is null
      or exists (
        select 1 from purchases p
        where p.customer_id = c.id
          and p.branch_id   = p_branch_id
      )
    )
  order by c.total_spending desc
  limit p_limit;
$$;


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

alter table branches             enable row level security;
alter table customers            enable row level security;
alter table purchases            enable row level security;
alter table purchase_items       enable row level security;
alter table points_transactions  enable row level security;
alter table campaigns            enable row level security;

-- Helper: is the request coming from an authenticated staff member?
create or replace function is_authenticated_staff()
returns boolean language sql security definer stable as $$
  select auth.uid() is not null;
$$;

-- branches: all authenticated users can read; only service_role can write
create policy "staff_read_branches"
  on branches for select using (is_authenticated_staff());
create policy "service_role_write_branches"
  on branches for all using (auth.role() = 'service_role');

-- customers: authenticated staff can read & write
create policy "staff_read_customers"   on customers for select using (is_authenticated_staff());
create policy "staff_insert_customers" on customers for insert with check (is_authenticated_staff());
create policy "staff_update_customers" on customers for update using (is_authenticated_staff());
create policy "staff_delete_customers" on customers for delete using (is_authenticated_staff());

-- purchases: authenticated staff can read & insert; no client-side deletes
create policy "staff_read_purchases"   on purchases for select using (is_authenticated_staff());
create policy "staff_insert_purchases" on purchases for insert with check (is_authenticated_staff());

-- purchase_items: same as purchases
create policy "staff_read_items"   on purchase_items for select using (is_authenticated_staff());
create policy "staff_insert_items" on purchase_items for insert with check (is_authenticated_staff());

-- points_transactions: read + insert; no updates or deletes (immutable ledger)
create policy "staff_read_points"   on points_transactions for select using (is_authenticated_staff());
create policy "staff_insert_points" on points_transactions for insert with check (is_authenticated_staff());

-- campaigns: authenticated staff can read & write
create policy "staff_read_campaigns"   on campaigns for select using (is_authenticated_staff());
create policy "staff_write_campaigns"  on campaigns for all   using (is_authenticated_staff());


-- ============================================================
-- 7. SEED DATA
-- ============================================================

-- ── branches ─────────────────────────────────────────────────
insert into branches (id, name, location, phone, color_hex, sort_order) values
  ('b1000000-0000-0000-0000-000000000001', 'The Bakery',   'Sukhumvit Soi 11, Bangkok',   '02-111-1111', '#c45f12', 1),
  ('b1000000-0000-0000-0000-000000000002', 'Brunch Club',  'Silom Road, Bangkok',          '02-222-2222', '#0f766e', 2),
  ('b1000000-0000-0000-0000-000000000003', 'Café Corner',  'Nimman Road, Chiang Mai',      '053-333-333', '#7c3aed', 3)
on conflict (id) do nothing;


-- ── customers ────────────────────────────────────────────────
insert into customers (
  id, name, phone, line_id, birthday,
  total_spending, total_points, visit_count, last_visit_at, segment,
  home_branch_id, notes
) values
  ('c1000001-0000-0000-0000-000000000001',
   'Somchai Jaidee',   '081-234-5678', 'line_somchai',  '1990-03-15',
   18500, 540, 42, now() - interval '2 days',  'vip',
   'b1000000-0000-0000-0000-000000000001', 'Nut allergy; prefers sourdough'),

  ('c1000001-0000-0000-0000-000000000002',
   'Malee Srisuwan',   '082-345-6789', 'line_malee',    '1988-07-22',
   5200,  104, 18, now() - interval '8 days',  'returning',
   'b1000000-0000-0000-0000-000000000002', 'Regular brunch, table for 2'),

  ('c1000001-0000-0000-0000-000000000003',
   'Preecha Tongsuk',  '083-456-7890', null,            '1995-11-05',
   420,   16,  2,  now() - interval '1 day',   'new',
   'b1000000-0000-0000-0000-000000000003', null),

  ('c1000001-0000-0000-0000-000000000004',
   'Naphat Wongwai',   '084-567-8901', 'line_naphat',   '1992-01-30',
   3100,  0,   9,  now() - interval '120 days','inactive',
   'b1000000-0000-0000-0000-000000000001', 'Interested in loyalty card'),

  ('c1000001-0000-0000-0000-000000000005',
   'Usa Pattana',      '085-678-9012', null,            '1985-05-18',
   12800, 312, 31, now() - interval '4 days',  'vip',
   'b1000000-0000-0000-0000-000000000001', 'Corporate billing — TechCo Ltd'),

  ('c1000001-0000-0000-0000-000000000006',
   'Wanida Khampha',   '086-789-0123', 'line_wanida',   '1993-09-10',
   6700,  188, 22, now() - interval '12 days', 'returning',
   'b1000000-0000-0000-0000-000000000002', null),

  ('c1000001-0000-0000-0000-000000000007',
   'Anan Buranasiri',  '087-890-1234', null,            '1998-12-25',
   180,   7,   1,  now() - interval '3 days',  'new',
   'b1000000-0000-0000-0000-000000000003', null),

  ('c1000001-0000-0000-0000-000000000008',
   'Siriporn Narkpet', '088-901-2345', 'line_siriporn', '1987-04-14',
   1800,  0,   6,  now() - interval '150 days','inactive',
   'b1000000-0000-0000-0000-000000000002', 'Birthday promo sent Apr 2025'),

  ('c1000001-0000-0000-0000-000000000009',
   'Kritsana Chaikul', '089-012-3456', 'line_kritsana', '1991-08-08',
   22000, 780, 58, now() - interval '1 day',   'vip',
   'b1000000-0000-0000-0000-000000000002', 'Top spender; personal menu requests'),

  ('c1000001-0000-0000-0000-000000000010',
   'Panida Sakulrat',  '080-123-4567', null,            '1996-02-28',
   4300,  88,  14, now() - interval '20 days', 'returning',
   'b1000000-0000-0000-0000-000000000003', null),

  ('c1000001-0000-0000-0000-000000000011',
   'Thana Pimchan',    '081-111-2222', 'line_thana',    '1989-06-03',
   8100,  224, 26, now() - interval '7 days',  'returning',
   'b1000000-0000-0000-0000-000000000001', 'Vegan preferences'),

  ('c1000001-0000-0000-0000-000000000012',
   'Oraluck Chaiyot',  '082-222-3333', null,            '1994-10-17',
   15600, 456, 38, now() - interval '2 days',  'vip',
   'b1000000-0000-0000-0000-000000000003', null)
on conflict (id) do nothing;


-- ── purchases ────────────────────────────────────────────────
-- Note: created_by is null in seed (no auth.users rows).
-- In production this would be set to the staff user's UUID.

insert into purchases (id, customer_id, branch_id, purchased_at, total_amount, points_earned, staff_note)
values
  ('b2000001-0000-0000-0000-000000000001',
   'c1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   now() - interval '2 days', 1050.00, 42, 'Weekly sourdough order'),

  ('b2000001-0000-0000-0000-000000000002',
   'c1000001-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000002',
   now() - interval '1 day',  1560.00, 62, 'Group of 4'),

  ('b2000001-0000-0000-0000-000000000003',
   'c1000001-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001',
   now() - interval '4 days', 2400.00, 96, 'Corporate event cake'),

  ('b2000001-0000-0000-0000-000000000004',
   'c1000001-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000003',
   now() - interval '2 days',  720.00, 28, null),

  ('b2000001-0000-0000-0000-000000000005',
   'c1000001-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
   now() - interval '8 days',  890.00, 35, 'Table 4'),

  ('b2000001-0000-0000-0000-000000000006',
   'c1000001-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000001',
   now() - interval '7 days',  580.00, 23, null),

  ('b2000001-0000-0000-0000-000000000007',
   'c1000001-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003',
   now() - interval '1 day',   420.00, 16, null),

  ('b2000001-0000-0000-0000-000000000008',
   'c1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003',
   now() - interval '16 days', 680.00, 27, null),

  ('b2000001-0000-0000-0000-000000000009',
   'c1000001-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000002',
   now() - interval '12 days', 760.00, 30, null),

  ('b2000001-0000-0000-0000-000000000010',
   'c1000001-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000003',
   now() - interval '20 days', 440.00, 17, null)
on conflict (id) do nothing;


-- ── purchase_items ───────────────────────────────────────────
insert into purchase_items (purchase_id, name, quantity, unit_price) values
  -- p01 — Somchai @ Bakery
  ('b2000001-0000-0000-0000-000000000001', 'Sourdough Loaf',    2, 380.00),
  ('b2000001-0000-0000-0000-000000000001', 'Croissant',         2,  90.00),
  ('b2000001-0000-0000-0000-000000000001', 'Latte',             1, 110.00),

  -- p02 — Kritsana @ Brunch
  ('b2000001-0000-0000-0000-000000000002', 'Full Breakfast Set', 4, 390.00),

  -- p03 — Usa @ Bakery
  ('b2000001-0000-0000-0000-000000000003', 'Celebration Cake',  1, 1800.00),
  ('b2000001-0000-0000-0000-000000000003', 'Macaron Box',       3,  200.00),

  -- p04 — Oraluck @ Café
  ('b2000001-0000-0000-0000-000000000004', 'Flat White',        2, 130.00),
  ('b2000001-0000-0000-0000-000000000004', 'Banana Bread',      2, 110.00),
  ('b2000001-0000-0000-0000-000000000004', 'Cheesecake Slice',  1, 180.00),

  -- p05 — Malee @ Brunch
  ('b2000001-0000-0000-0000-000000000005', 'Eggs Benedict',     2, 320.00),
  ('b2000001-0000-0000-0000-000000000005', 'Fresh Juice',       2, 125.00),

  -- p06 — Thana @ Bakery
  ('b2000001-0000-0000-0000-000000000006', 'Pain au Chocolat',  3,  95.00),
  ('b2000001-0000-0000-0000-000000000006', 'Almond Milk Latte', 2, 125.00),
  ('b2000001-0000-0000-0000-000000000006', 'Granola Bowl',      1, 165.00),

  -- p07 — Preecha @ Café
  ('b2000001-0000-0000-0000-000000000007', 'Cappuccino',        2, 120.00),
  ('b2000001-0000-0000-0000-000000000007', 'Avocado Toast',     1, 180.00),

  -- p08 — Somchai @ Café (cross-branch visit)
  ('b2000001-0000-0000-0000-000000000008', 'Flat White',        2, 130.00),
  ('b2000001-0000-0000-0000-000000000008', 'Banana Bread',      1, 110.00),
  ('b2000001-0000-0000-0000-000000000008', 'Cheesecake',        1, 180.00),

  -- p09 — Wanida @ Brunch
  ('b2000001-0000-0000-0000-000000000009', 'Brunch Platter',    2, 380.00),

  -- p10 — Panida @ Café
  ('b2000001-0000-0000-0000-000000000010', 'Iced Matcha Latte', 2, 140.00),
  ('b2000001-0000-0000-0000-000000000010', 'Mango Tart',        1, 160.00)
on conflict do nothing;


-- ── points_transactions ──────────────────────────────────────
insert into points_transactions
  (id, customer_id, branch_id, purchase_id, type, points, balance_after, note)
values
  -- Earn events (linked to purchases)
  ('b3000001-0000-0000-0000-000000000001',
   'c1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'b2000001-0000-0000-0000-000000000001', 'earn', 42, 540, 'Points earned from purchase'),

  ('b3000001-0000-0000-0000-000000000002',
   'c1000001-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000002',
   'b2000001-0000-0000-0000-000000000002', 'earn', 62, 780, 'Points earned from purchase'),

  ('b3000001-0000-0000-0000-000000000003',
   'c1000001-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001',
   'b2000001-0000-0000-0000-000000000003', 'earn', 96, 312, 'Points earned from purchase'),

  ('b3000001-0000-0000-0000-000000000004',
   'c1000001-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000003',
   'b2000001-0000-0000-0000-000000000004', 'earn', 28, 456, 'Points earned from purchase'),

  ('b3000001-0000-0000-0000-000000000005',
   'c1000001-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
   'b2000001-0000-0000-0000-000000000005', 'earn', 35, 104, 'Points earned from purchase'),

  -- Redeem — Somchai redeems 100 pts at Bakery
  ('b3000001-0000-0000-0000-000000000006',
   'c1000001-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   null, 'redeem', -100, 440, 'Redeemed for free coffee (100 pts)'),

  -- Manual adjust — Kritsana birthday bonus
  ('b3000001-0000-0000-0000-000000000007',
   'c1000001-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000002',
   null, 'adjust', 50, 830, 'Birthday bonus — August promotion'),

  -- Expiry — Naphat inactive
  ('b3000001-0000-0000-0000-000000000008',
   'c1000001-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001',
   null, 'expire', -84, 0, 'Points expired after 180 days of inactivity')
on conflict (id) do nothing;


-- ── campaigns ────────────────────────────────────────────────
insert into campaigns
  (id, name, description, target_segment, target_branch_id, status, starts_at, ends_at)
values
  ('cab00001-0000-0000-0000-000000000001',
   'Birthday Month Bonus',
   'Double points for customers whose birthday falls this month.',
   'all', null, 'active',
   '2025-05-01 00:00:00+07', '2025-05-31 23:59:59+07'),

  ('cab00001-0000-0000-0000-000000000002',
   'VIP Loyalty Reward',
   'Exclusive 20% discount on all items for VIP members at The Bakery.',
   'vip', 'b1000000-0000-0000-0000-000000000001', 'active',
   '2025-05-01 00:00:00+07', '2025-05-15 23:59:59+07'),

  ('cab00001-0000-0000-0000-000000000003',
   'Win Back Inactive Customers',
   '50 bonus points credited on next visit for customers inactive 90+ days.',
   'inactive', null, 'draft',
   '2025-06-01 00:00:00+07', '2025-06-30 23:59:59+07'),

  ('cab00001-0000-0000-0000-000000000004',
   'New Member Welcome',
   'Earn 3× points on your first 3 purchases after signing up.',
   'new', null, 'draft',
   '2025-06-01 00:00:00+07', null),

  ('cab00001-0000-0000-0000-000000000005',
   'Brunch Weekend Special',
   'Free drip coffee with any brunch set, Saturdays and Sundays.',
   'returning', 'b1000000-0000-0000-0000-000000000002', 'ended',
   '2025-04-05 00:00:00+07', '2025-04-30 23:59:59+07')
on conflict (id) do nothing;
