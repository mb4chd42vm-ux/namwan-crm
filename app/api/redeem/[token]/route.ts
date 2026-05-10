import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/redeem/[token]
 *
 * Staff preview: validate token, return customer info and reward details.
 * Does NOT deduct points.
 *
 * Response:
 *   { valid: true, customer: { name, total_points }, reward_name, points_required, expires_at }
 *   { valid: false, reason: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const db        = adminClient()

  // Expire stale tokens first
  await db.rpc('expire_stale_redeem_requests')

  const { data: request } = await db
    .from('redeem_requests')
    .select(`
      id, token, status, expires_at, reward_name, points_required,
      customers ( id, name, total_points, phone )
    `)
    .eq('token', token)
    .single()

  if (!request) {
    return NextResponse.json({ valid: false, reason: 'Token not found' }, { status: 404 })
  }

  if (request.status === 'completed') {
    return NextResponse.json({ valid: false, reason: 'Already redeemed' })
  }

  if (request.status === 'expired') {
    return NextResponse.json({ valid: false, reason: 'QR code has expired' })
  }

  if (request.status === 'cancelled') {
    return NextResponse.json({ valid: false, reason: 'Request was cancelled' })
  }

  const customer = request.customers as unknown as {
    id: string; name: string; total_points: number; phone: string
  } | null

  if (!customer) {
    return NextResponse.json({ valid: false, reason: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({
    valid:           true,
    request_id:      request.id,
    reward_name:     request.reward_name,
    points_required: request.points_required,
    expires_at:      request.expires_at,
    customer: {
      id:           customer.id,
      name:         customer.name,
      phone:        customer.phone,
      total_points: customer.total_points,
    },
  })
}

/**
 * POST /api/redeem/[token]/confirm
 *
 * Staff confirms redemption. Deducts points_required and marks request completed.
 *
 * Body: { branch_id: string }
 *
 * Response:
 *   { success: true, new_balance: number, confirmed_at: string }
 *   { error: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  let body: { branch_id?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { branch_id } = body

  if (!branch_id) {
    return NextResponse.json({ error: 'branch_id required' }, { status: 400 })
  }

  const db = adminClient()

  // Expire stale tokens first
  await db.rpc('expire_stale_redeem_requests')

  // Fetch the pending request (with customer for balance check)
  const { data: request } = await db
    .from('redeem_requests')
    .select(`
      id, status, expires_at, points_required,
      customers ( id, total_points )
    `)
    .eq('token', token)
    .single()

  if (!request) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  if (request.status !== 'pending') {
    const reasons: Record<string, string> = {
      completed: 'Already redeemed',
      expired:   'QR code has expired',
      cancelled: 'Request was cancelled',
    }
    return NextResponse.json(
      { error: reasons[request.status] ?? 'Request is no longer valid' },
      { status: 409 },
    )
  }

  const customer = request.customers as unknown as { id: string; total_points: number } | null

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  if (customer.total_points < request.points_required) {
    // Cancel the request since it can't be fulfilled
    await db
      .from('redeem_requests')
      .update({ status: 'cancelled' })
      .eq('id', request.id)

    return NextResponse.json(
      { error: `Insufficient points (need ${request.points_required}, have ${customer.total_points})` },
      { status: 400 },
    )
  }

  // Deduct points via RPC
  const { error: rpcErr } = await db.rpc('adjust_points', {
    p_customer_id:  customer.id,
    p_branch_id:    branch_id,
    p_type:         'redeem',
    p_points:       request.points_required,
    p_note:         'Redeemed 1 free drink (staff confirmed)',
    p_performed_by: null,
  })

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 })
  }

  const confirmed_at = new Date().toISOString()

  // Mark request completed
  await db
    .from('redeem_requests')
    .update({
      status:       'completed',
      branch_id,
      confirmed_at,
    })
    .eq('id', request.id)

  // Fetch refreshed balance
  const { data: updated } = await db
    .from('customers')
    .select('total_points')
    .eq('id', customer.id)
    .single()

  const new_balance = updated?.total_points ?? Math.max(0, customer.total_points - request.points_required)

  return NextResponse.json({ success: true, new_balance, confirmed_at })
}
