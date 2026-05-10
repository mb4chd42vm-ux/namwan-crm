import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const LABEL = '[redeem-confirm]'

/**
 * GET /api/redeem/[token]
 *
 * Staff preview: validate token, return customer info and reward details.
 * Does NOT deduct points.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const db        = adminClient()

    // Expire stale tokens (non-fatal)
    try { await db.rpc('expire_stale_redeem_requests') } catch (e) {
      console.warn(`${LABEL} expire_stale_redeem_requests failed (non-fatal):`, e)
    }

    const { data: request, error } = await db
      .from('redeem_requests')
      .select(`
        id, token, status, expires_at, reward_name, points_required,
        customers ( id, name, total_points, phone )
      `)
      .eq('token', token)
      .single()

    if (error || !request) {
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
  } catch (e) {
    console.error(`${LABEL} GET unhandled:`, e)
    return NextResponse.json(
      { valid: false, reason: 'Server error — please try again' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/redeem/[token]
 *
 * Staff confirms redemption:
 *   1. Load redeem_requests by token
 *   2. Verify status = pending and not expired
 *   3. Verify customer balance >= points_required
 *   4. Insert points_transactions (type = redeem, points = -points_required)
 *   5. Update redeem_requests: status = completed, branch_id, confirmed_at
 *   6. Revalidate /points and /customers
 *
 * Body: { branch_id: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    let body: { branch_id?: string }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { branch_id } = body

    if (!branch_id) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 })
    }

    const db = adminClient()

    // Expire stale tokens (non-fatal)
    try { await db.rpc('expire_stale_redeem_requests') } catch (e) {
      console.warn(`${LABEL} expire_stale_redeem_requests failed (non-fatal):`, e)
    }

    // ── 1. Load the request ──────────────────────────────────────────────────
    const { data: request, error: fetchErr } = await db
      .from('redeem_requests')
      .select(`
        id, status, expires_at, points_required,
        customer_id,
        customers ( id, total_points )
      `)
      .eq('token', token)
      .single()

    if (fetchErr || !request) {
      console.error(`${LABEL} token lookup failed:`, fetchErr)
      return NextResponse.json({ error: 'Redeem request not found' }, { status: 404 })
    }

    // ── 2. Verify status = pending ───────────────────────────────────────────
    if (request.status !== 'pending') {
      const reasons: Record<string, string> = {
        completed: 'This QR has already been redeemed',
        expired:   'QR code has expired — ask customer to generate a new one',
        cancelled: 'This redemption request was cancelled',
      }
      const reason = reasons[request.status] ?? `Request status is '${request.status}'`
      console.warn(`${LABEL} non-pending status: ${request.status} for token ${token}`)
      return NextResponse.json({ error: reason }, { status: 409 })
    }

    // ── 3. Verify not expired ────────────────────────────────────────────────
    if (new Date(request.expires_at) < new Date()) {
      // Mark expired
      await db.from('redeem_requests').update({ status: 'expired' }).eq('id', request.id)
      console.warn(`${LABEL} token expired at ${request.expires_at}`)
      return NextResponse.json(
        { error: 'QR code has expired — ask customer to generate a new one' },
        { status: 409 },
      )
    }

    const customer = request.customers as unknown as { id: string; total_points: number } | null

    if (!customer) {
      console.error(`${LABEL} customer missing for request ${request.id}`)
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    const pointsRequired = request.points_required ?? 10

    // ── 4. Verify customer balance ───────────────────────────────────────────
    if (customer.total_points < pointsRequired) {
      console.warn(`${LABEL} insufficient points: has ${customer.total_points}, needs ${pointsRequired}`)
      return NextResponse.json(
        { error: `Insufficient points — customer has ${customer.total_points} but needs ${pointsRequired}` },
        { status: 400 },
      )
    }

    // ── 5. Deduct points via adjust_points RPC ───────────────────────────────
    // adjust_points with type='redeem' applies -abs(p_points) and inserts the
    // points_transactions ledger row atomically.
    const { error: rpcErr } = await db.rpc('adjust_points', {
      p_customer_id:  customer.id,
      p_branch_id:    branch_id,
      p_type:         'redeem',
      p_points:       pointsRequired,   // positive; RPC negates for redeem
      p_note:         'Redeemed 1 free drink',
      p_performed_by: null,             // staff_profiles not required
    })

    if (rpcErr) {
      console.error(`${LABEL} adjust_points RPC failed:`, rpcErr)
      return NextResponse.json(
        { error: `Points deduction failed: ${rpcErr.message}` },
        { status: 500 },
      )
    }

    // ── 6. Mark request completed ────────────────────────────────────────────
    const confirmed_at = new Date().toISOString()

    const { error: updateErr } = await db
      .from('redeem_requests')
      .update({
        status:                'completed',
        branch_id,
        confirmed_at,
        confirmed_by_staff_id: null,   // allowed null — no staff_profiles dependency
      })
      .eq('id', request.id)

    if (updateErr) {
      // Points already deducted — log but don't fail the response
      console.error(`${LABEL} failed to mark request completed (points already deducted):`, updateErr)
    }

    // ── 7. Fetch refreshed balance ───────────────────────────────────────────
    const { data: updated } = await db
      .from('customers')
      .select('total_points')
      .eq('id', customer.id)
      .single()

    const new_balance = updated?.total_points ?? Math.max(0, customer.total_points - pointsRequired)

    // ── 8. Revalidate ────────────────────────────────────────────────────────
    try {
      revalidatePath('/points')
      revalidatePath(`/customers/${customer.id}`)
    } catch (e) {
      console.warn(`${LABEL} revalidatePath failed (non-fatal):`, e)
    }

    console.log(`${LABEL} confirmed — customer ${customer.id} new balance: ${new_balance}`)

    return NextResponse.json({ success: true, new_balance, confirmed_at })

  } catch (e) {
    console.error(`${LABEL} POST unhandled exception:`, e)
    const message = e instanceof Error ? e.message : 'Unknown server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
