import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const POINTS_PER_DRINK = 10

/**
 * POST /api/liff/redeem
 *
 * Redeems exactly 1 free drink (10 points) for a customer identified by line_id.
 *
 * Body: { line_id: string, branch_id?: string }
 *
 * Response:
 *   { success: true, new_balance: number }
 *   { error: string }
 */
export async function POST(req: NextRequest) {
  let body: { line_id?: string; branch_id?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { line_id, branch_id } = body

  if (!line_id) {
    return NextResponse.json({ error: 'line_id required' }, { status: 400 })
  }

  const db = adminClient()

  // 1. Find customer by line_id
  const { data: customer } = await db
    .from('customers')
    .select('id, total_points, home_branch_id')
    .eq('line_id', line_id)
    .eq('is_active', true)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  if ((customer.total_points ?? 0) < POINTS_PER_DRINK) {
    return NextResponse.json(
      { error: `Not enough points — need ${POINTS_PER_DRINK}, have ${customer.total_points ?? 0}` },
      { status: 400 },
    )
  }

  // Use provided branch_id or fall back to home_branch_id
  const effectiveBranchId = branch_id || customer.home_branch_id
  if (!effectiveBranchId) {
    return NextResponse.json(
      { error: 'No branch available — please contact staff to redeem' },
      { status: 400 },
    )
  }

  // 2. Deduct via RPC
  const { error: rpcErr } = await db.rpc('adjust_points', {
    p_customer_id:  customer.id,
    p_branch_id:    effectiveBranchId,
    p_type:         'redeem',
    p_points:       POINTS_PER_DRINK,
    p_note:         'Redeemed 1 free drink',
    p_performed_by: null,
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  // 3. Return refreshed balance
  const { data: updated } = await db
    .from('customers')
    .select('total_points')
    .eq('id', customer.id)
    .single()

  const new_balance = updated?.total_points ?? Math.max(0, (customer.total_points ?? 0) - POINTS_PER_DRINK)

  return NextResponse.json({ success: true, new_balance })
}
