-- ============================================================
--  Staff Profiles
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

create table if not exists public.staff_profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  name        text        not null,
  email       text        not null,
  role        text        not null default 'staff'
                          check (role in ('admin', 'manager', 'staff')),
  branch_id   uuid        references public.branches(id) on delete set null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────
create index if not exists staff_profiles_role_idx on public.staff_profiles(role);

-- ── Row Level Security ─────────────────────────────────────
alter table public.staff_profiles enable row level security;

-- Each staff member can read their own profile.
-- Admin/manager reads are handled server-side via the service role key (bypasses RLS).
create policy "staff: select own profile"
  on public.staff_profiles for select
  to authenticated
  using (auth.uid() = id);

-- ── Auto-update updated_at ─────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger staff_profiles_updated_at
  before update on public.staff_profiles
  for each row execute function public.handle_updated_at();

-- ============================================================
--  After creating a user in Supabase Auth Dashboard, insert
--  their profile here. Example:
--
--  insert into public.staff_profiles (id, name, email, role)
--  values (
--    '<paste-auth-user-uuid-here>',
--    'Admin User',
--    'admin@example.com',
--    'admin'
--  );
-- ============================================================
