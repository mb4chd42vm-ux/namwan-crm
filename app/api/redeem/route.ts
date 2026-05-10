import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const POINTS_PER_DRINK  = 10
const EXPIRY_MINUTES    = 10

/**
 * POST /api/redeem
 *
 * Customer requests a redemption QR. Does NOT deduct points.
 * Staff must scan and confirm at POST /api/redeem/[token]/confirm.
 *
 * Body: { line_id: string }
 *
 * Response:
 *   { token, redeem_url, expires_at, reward_name, points_required }
 *   { error: string }
 */
export async function POST(req: NextRequest) {
  let body: { line_id?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { line_id } = body

  if (!line_id) {
    return NextResponse.json({ error: 'line_id required' }, { status: 400 })
  }

  const db = adminClient()

  // Find customer
  const { data: customer } = await db
    .from('customers')
    .select('id, total_points')
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

  // Cancel any existing pending requests for this customer (one active at a time)
  await db
    .from('redeem_requests')
    .update({ status: 'cancelled' })
    .eq('customer_id', customer.id)
    .eq('status', 'pending')

  // Generate token + expiry
  const token      = randomBytes(24).toString('hex')
  const expires_at = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString()

  const { data: request, error: insertErr } = await db
    .from('redeem_requests')
    .insert({
      token,
      customer_id:     customer.id,
      line_id,
      reward_name:     '1 Free Drink',
      points_required: POINTS_PER_DRINK,
      expires_at,
    })
    .select('id, token, expires_at, reward_name, points_required')
    .single()

  if (insertErr || !request) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create request' }, { status: 500 })
  }

  const origin     = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const redeem_url = `${origin}/points/redeem/confirm/${request.token}`

  return NextResponse.json({
    token:           request.token,
    redeem_url,
    expires_at:      request.expires_at,
    reward_name:     request.reward_name,
    points_required: request.points_required,
  })
}
