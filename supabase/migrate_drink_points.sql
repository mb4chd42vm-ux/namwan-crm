-- ============================================================
--  Migration: Drink-based points system
--  Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add drink_quantity column to purchases
alter table public.purchases
  add column if not exists drink_quantity integer not null default 0;

-- 2. Backfill existing rows: derive drink_quantity from points_earned (1:1)
update public.purchases
set drink_quantity = points_earned
where drink_quantity = 0 and points_earned > 0;

-- 3. Replace log_purchase RPC — now takes p_drink_quantity instead of deriving points from amount
create or replace function log_purchase(
  p_customer_id    uuid,
  p_branch_id      uuid,
  p_items          jsonb,           -- [{name, quantity, unit_price}, ...]
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
  -- 1. Calculate bill total from items (still tracked for revenue reporting)
  select coalesce(sum((item->>'quantity')::int * (item->>'unit_price')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_items) as item;

  if v_total <= 0 then
    raise exception 'Purchase total must be greater than zero';
  end if;

  if p_drink_quantity < 0 then
    raise exception 'Drink quantity cannot be negative';
  end if;

  -- 2. Points: 1 drink = 1 point (NOT amount-based anymore)
  v_points_earned := p_drink_quantity;

  -- 3. Insert purchase header
  insert into purchases (customer_id, branch_id, total_amount, points_earned, drink_quantity, staff_note, created_by)
  values (p_customer_id, p_branch_id, v_total, v_points_earned, p_drink_quantity, p_staff_note, p_performed_by)
  returning id into v_purchase_id;

  -- 4. Insert line items
  insert into purchase_items (purchase_id, name, quantity, unit_price)
  select
    v_purchase_id,
    item->>'name',
    (item->>'quantity')::smallint,
    (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) as item;

  -- 5. Update customer aggregates atomically
  update customers
  set
    total_spending  = total_spending  + v_total,
    total_points    = total_points    + v_points_earned,
    visit_count     = visit_count     + 1,
    last_visit_at   = now(),
    segment         = derive_segment(total_spending + v_total, visit_count + 1, now())
  where id = p_customer_id
  returning total_points, total_spending, visit_count
  into v_new_balance, v_new_spending, v_new_visits;

  if not found then
    raise exception 'Customer not found: %', p_customer_id;
  end if;

  -- 6. Record earn transaction (only if points > 0)
  if v_points_earned > 0 then
    insert into points_transactions
      (customer_id, branch_id, purchase_id, type, points, balance_after, note, performed_by)
    values
      (p_customer_id, p_branch_id, v_purchase_id, 'earn', v_points_earned, v_new_balance,
       'Earned ' || v_points_earned || ' point' || case when v_points_earned = 1 then '' else 's' end || ' (' || p_drink_quantity || ' drink' || case when p_drink_quantity = 1 then '' else 's' end || ')',
       p_performed_by);
  end if;

  return v_purchase_id;
end;
$$;

-- ============================================================
--  Redemption rules (no schema change needed):
--  10 points = 1 free drink
--  adjust_points already handles atomic deduction — just pass
--  p_points = free_drink_count * 10 from the application layer
-- ============================================================
