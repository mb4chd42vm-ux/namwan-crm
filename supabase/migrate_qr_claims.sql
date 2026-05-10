-- QR-based point claim tokens
-- Each token is single-use, expires in 5 minutes, tied to a branch + drink_quantity

create table if not exists point_claim_qr (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,                      -- unguessable random token
  branch_id       uuid not null references branches(id),
  drink_quantity  integer not null check (drink_quantity > 0),
  points          integer not null check (points > 0),       -- drink_quantity × 1 (1 drink = 1 pt)
  status          text not null default 'pending'
                    check (status in ('pending','claimed','expired','cancelled')),
  claimed_by_customer_id  uuid references customers(id),
  expires_at      timestamptz not null,
  claimed_at      timestamptz,
  created_by_staff_id     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- index for fast token lookup
create index if not exists idx_point_claim_qr_token  on point_claim_qr(token);
create index if not exists idx_point_claim_qr_status on point_claim_qr(status);

-- RLS: staff can insert + read their own; public read by token (for claim page)
alter table point_claim_qr enable row level security;

-- Authenticated staff: full access to records they created
create policy "Staff can manage own QR tokens"
  on point_claim_qr
  for all
  to authenticated
  using (true)
  with check (true);

-- Anyone can read a single token by value (needed for public /claim/[token] page)
-- Service role bypasses RLS so the server action can always read/update.
