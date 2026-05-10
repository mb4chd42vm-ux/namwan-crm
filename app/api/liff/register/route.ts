import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/liff/register
 *
 * Links a LINE account to a customer (by phone) or creates a new customer.
 *
 * Body: { line_id, display_name, picture_url?, phone }
 *
 * Response:
 *   { status: 'linked',       customer }  — found by phone, linked LINE
 *   { status: 'created',      customer }  — no phone match, new customer created
 *   { status: 'already_linked'          }  — phone belongs to a different LINE id
 */
export async function POST(req: NextRequest) {
  let body: { line_id?: string; display_name?: string; picture_url?: string; phone?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { line_id, display_name, picture_url, phone } = body

  if (!line_id)       return NextResponse.json({ error: 'line_id required' },       { status: 400 })
  if (!display_name)  return NextResponse.json({ error: 'display_name required' },  { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'phone required' },         { status: 400 })

  const db       = adminClient()
  const phoneStr = phone.trim()

  // 1. Try to find existing customer by phone
  const { data: existing } = await db
    .from('customers')
    .select('id, name, line_id')
    .eq('phone', phoneStr)
    .eq('is_active', true)
    .single()

  if (existing) {
    // Phone found — check if already linked to a different LINE account
    if (existing.line_id && existing.line_id !== line_id) {
      return NextResponse.json({ status: 'already_linked' })
    }

    // Link (or re-link) this LINE account
    const { data: updated } = await db
      .from('customers')
      .update({ line_id, picture_url: picture_url ?? null })
      .eq('id', existing.id)
      .select('id, name, phone, line_id, picture_url, total_points, total_spending, visit_count, segment')
      .single()

    return NextResponse.json({ status: 'linked', customer: updated })
  }

  // 2. No existing customer — create a new one
  const { data: created, error: createErr } = await db
    .from('customers')
    .insert({
      name:        display_name,
      phone:       phoneStr,
      line_id,
      picture_url: picture_url ?? null,
    })
    .select('id, name, phone, line_id, picture_url, total_points, total_spending, visit_count, segment')
    .single()

  if (createErr) {
    // Unique constraint violation (phone taken by a different record)
    if (createErr.code === '23505') {
      return NextResponse.json({ status: 'already_linked' })
    }
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'created', customer: created })
}
