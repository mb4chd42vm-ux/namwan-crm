-- ============================================================
--  Migration 002 — Staff Profiles (new schema)
--
--  Handles two starting states:
--    A. Fresh DB (no staff_profiles table yet)
--    B. Existing DB with old schema (id = PK + FK to auth.users)
--
--  Result in both cases:
--    staff_profiles(
--      id            uuid PK DEFAULT gen_random_uuid(),
--      auth_user_id  uuid NOT NULL UNIQUE FK → auth.users(id),
--      name          text NOT NULL,
--      email         text NOT NULL UNIQUE,
--      role          text NOT NULL DEFAULT 'staff',
--      branch_id     uuid FK → branches(id),
--      is_active     boolean NOT NULL DEFAULT true,
--      created_at    timestamptz NOT NULL DEFAULT now(),
--      updated_at    timestamptz NOT NULL DEFAULT now()
--    )
-- ============================================================


-- ============================================================
-- STEP 1: Migrate old schema → new schema (if needed)
--
-- Old design: id = PK AND FK to auth.users(id)
-- New design: id = independent PK, auth_user_id = FK to auth.users
-- ============================================================

do $$
declare
  v_table_exists    boolean;
  v_col_exists      boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_profiles'
  ) into v_table_exists;

  if not v_table_exists then
    -- Nothing to migrate — CREATE TABLE below handles the fresh case
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'staff_profiles'
      and column_name  = 'auth_user_id'
  ) into v_col_exists;

  if v_col_exists then
    -- Already migrated (or fresh table was created with new schema)
    return;
  end if;

  -- ── Old schema detected — migrate ────────────────────────────

  -- 1. Add auth_user_id (nullable to start so we can backfill)
  execute 'alter table public.staff_profiles
             add column auth_user_id uuid references auth.users(id) on delete cascade';

  -- 2. Backfill: in old design, id IS the auth user id
  execute 'update public.staff_profiles set auth_user_id = id';

  -- 3. Make NOT NULL now that every row has a value
  execute 'alter table public.staff_profiles
             alter column auth_user_id set not null';

  -- 4. Remove the old FK from id → auth.users
  --    Postgres auto-names it <table>_<col>_fkey; try the expected name(s)
  execute 'alter table public.staff_profiles
             drop constraint if exists staff_profiles_id_fkey';

  -- 5. Give id a default so future INSERTs auto-generate UUIDs
  execute 'alter table public.staff_profiles
             alter column id set default gen_random_uuid()';

end;
$$;


-- ============================================================
-- STEP 2: Create table (fresh DB path; no-op if already exists)
-- ============================================================

create table if not exists public.staff_profiles (
  id            uuid        primary key default gen_random_uuid(),
  auth_user_id  uuid        not null unique references auth.users(id) on delete cascade,
  name          text        not null,
  email         text        not null unique,
  role          text        not null default 'staff',
  branch_id     uuid        references public.branches(id) on delete set null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- STEP 3: Constraints
-- ============================================================

-- Role values
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.staff_profiles'::regclass
      and conname   = 'staff_profiles_role_check'
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_role_check
        check (role in ('admin', 'manager', 'staff'));
  end if;
end;
$$;

-- auth_user_id unique (already set in CREATE TABLE; belt-and-suspenders for migrate path)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.staff_profiles'::regclass
      and conname   = 'staff_profiles_auth_user_id_key'
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_auth_user_id_key unique (auth_user_id);
  end if;
end;
$$;

-- email unique
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.staff_profiles'::regclass
      and conname   = 'staff_profiles_email_key'
  ) then
    alter table public.staff_profiles
      add constraint staff_profiles_email_key unique (email);
  end if;
end;
$$;


-- ============================================================
-- STEP 4: Indexes
-- ============================================================

-- Primary lookup path: getStaffProfile queries by auth_user_id
create index if not exists idx_staff_profiles_auth_user_id
  on public.staff_profiles (auth_user_id);

-- Role-based filtering (staff list page, permission checks)
create index if not exists idx_staff_profiles_role
  on public.staff_profiles (role);

-- Branch assignment queries
create index if not exists idx_staff_profiles_branch_id
  on public.staff_profiles (branch_id)
  where branch_id is not null;

-- Active staff only
create index if not exists idx_staff_profiles_active
  on public.staff_profiles (is_active)
  where is_active = true;


-- ============================================================
-- STEP 5: updated_at trigger
-- ============================================================

create or replace function public.staff_profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_profiles_updated_at on public.staff_profiles;
create trigger trg_staff_profiles_updated_at
  before update on public.staff_profiles
  for each row execute function public.staff_profiles_set_updated_at();


-- ============================================================
-- STEP 6: Row Level Security
-- ============================================================

alter table public.staff_profiles enable row level security;

-- Drop old policy that used auth.uid() = id (now incorrect)
drop policy if exists "staff: select own profile" on public.staff_profiles;

-- Each staff member can read their own profile (by auth_user_id)
-- Admin reads of ALL profiles use the service role key (bypasses RLS)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'staff_profiles'
      and policyname = 'staff_select_own_profile'
  ) then
    execute $pol$
      create policy staff_select_own_profile
        on public.staff_profiles
        for select
        to authenticated
        using (auth.uid() = auth_user_id)
    $pol$;
  end if;
end;
$$;


-- ============================================================
-- STEP 7: Comments
-- ============================================================

comment on table public.staff_profiles is
  'CRM staff accounts. auth_user_id links to Supabase Auth; '
  'created via auth.admin.createUser() in the Invite Staff flow.';
comment on column public.staff_profiles.auth_user_id is
  'FK to auth.users(id). One-to-one. Used by getCurrentSession() to resolve profile.';
comment on column public.staff_profiles.role is
  'admin: full access. manager: no staff management. '
  'staff: purchases + QR + redeem only (no manual point adjust, no campaigns).';
comment on column public.staff_profiles.is_active is
  'false = account suspended. Login is blocked via Supabase Auth ban.';


-- ============================================================
-- STEP 8: Permission reference (documentation only)
--
-- Enforced in application code (lib/auth.ts):
--   canManageStaff(role)         → admin only
--   canEditPointsManually(role)  → admin | manager
--   canManageCampaigns(role)     → admin | manager
--   canManageBranches(role)      → admin only
--
-- UI enforcement:
--   Sidebar nav: Staff item hidden from manager + staff
--                Campaigns item hidden from staff
--   /points page: "Adjust Points" button hidden from staff
--   /campaigns page: server redirect for staff
--   /settings/staff page: server redirect for manager + staff
-- ============================================================
