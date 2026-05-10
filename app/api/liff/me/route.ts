import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/liff/me
 *
 * Called by the /member page after LIFF init.
 * Looks up the customer by line_id, optionally updates their picture_url,
 * and returns full member data including recent transactions and purchases.
 *
 * Body: { line_id: string, display_name: string, picture_url?: string }
 *
 * Response:
 *   { found: false }
 *   { found: true, customer, txs, purchases }
 */
export async function POST(req: NextRequest) {
  let body: { line_id?: string; display_name?: string; picture_url?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { line_id, picture_url } = body

  if (!line_id) {
    return NextResponse.json({ error: 'line_id required' }, { status: 400 })
  }

  const db = adminClient()

  // 1. Find customer by line_id
  const { data: customer } = await db
    .from('customers')
    .select('id, name, phone, line_id, picture_url, total_points, total_spending, visit_count, last_visit_at, segment, home_branch_id, is_active')
    .eq('line_id', line_id)
    .eq('is_active', true)
    .single()

  if (!customer) {
    return NextResponse.json({ found: false })
  }

  // 2. Update picture_url if changed
  if (picture_url && picture_url !== customer.picture_url) {
    await db
      .from('customers')
      .update({ picture_url })
      .eq('id', customer.id)
  }

  // 3. Fetch recent points transactions (last 15)
  const { data: txs } = await db
    .from('points_transactions')
    .select('id, type, points, balance_after, note, created_at, branches(name, color_hex)')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(15)

  // 4. Fetch recent purchases (last 8)
  const { data: purchases } = await db
    .from('purchases')
    .select('id, purchased_at, total_amount, points_earned, drink_quantity, branches(name, color_hex), purchase_items(name, quantity, unit_price)')
    .eq('customer_id', customer.id)
    .order('purchased_at', { ascending: false })
    .limit(8)

  return NextResponse.json({
    found: true,
    customer: { ...customer, picture_url: picture_url ?? customer.picture_url },
    txs:      txs       ?? [],
    purchases: purchases ?? [],
  })
}
