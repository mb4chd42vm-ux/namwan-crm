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
 * Links a LINE account to a customer (by phone) or creates a new one.
 * Accepts extended onboarding fields and marks profile_completed = true.
 *
 * Body:
 *   { line_id, display_name, picture_url?, phone,
 *     birthday?, gender?, area_or_province?, region?, favorite_branch_id?,
 *     discovered_from?, marketing_consent? }
 *
 * Response:
 *   { status: 'linked',        customer }
 *   { status: 'created',       customer }
 *   { status: 'already_linked'           }
 */
export async function POST(req: NextRequest) {
  let body: {
    line_id?:            string
    display_name?:       string
    picture_url?:        string
    phone?:              string
    birthday?:           string
    gender?:             string
    area_or_province?:   string
    region?:             string
    favorite_branch_id?: string
    discovered_from?:    string
    marketing_consent?:  boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    line_id,
    display_name,
    picture_url,
    phone,
    birthday,
    gender,
    area_or_province,
    region,
    favorite_branch_id,
    discovered_from,
    marketing_consent,
  } = body

  if (!line_id)       return NextResponse.json({ error: 'line_id required' },       { status: 400 })
  if (!display_name)  return NextResponse.json({ error: 'display_name required' },  { status: 400 })
  if (!phone?.trim()) return NextResponse.json({ error: 'phone required' },         { status: 400 })

  const db       = adminClient()
  const phoneStr = phone.trim()

  const profileFields = {
    picture_url:         picture_url       ?? null,
    birthday:            birthday           ?? null,
    gender:              gender             ?? null,
    area_or_province:    area_or_province   ?? null,
    region:              region             ?? null,
    favorite_branch_id:  favorite_branch_id ?? null,
    discovered_from:     discovered_from   ?? null,
    marketing_consent:   marketing_consent ?? false,
    profile_completed:   true,
  }

  // 1. Try to find existing customer by phone
  const { data: existing } = await db
    .from('customers')
    .select('id, name, line_id')
    .eq('phone', phoneStr)
    .eq('is_active', true)
    .single()

  if (existing) {
    if (existing.line_id && existing.line_id !== line_id) {
      return NextResponse.json({ status: 'already_linked' })
    }

    const { data: updated } = await db
      .from('customers')
      .update({ line_id, ...profileFields })
      .eq('id', existing.id)
      .select('id, name, phone, line_id, picture_url, total_points, total_spending, visit_count, segment, profile_completed')
      .single()

    return NextResponse.json({ status: 'linked', customer: updated })
  }

  // 2. No existing customer — create a new one
  const { data: created, error: createErr } = await db
    .from('customers')
    .insert({
      name:     display_name,
      phone:    phoneStr,
      line_id,
      ...profileFields,
    })
    .select('id, name, phone, line_id, picture_url, total_points, total_spending, visit_count, segment, profile_completed')
    .single()

  if (createErr) {
    if (createErr.code === '23505') {
      return NextResponse.json({ status: 'already_linked' })
    }
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'created', customer: created })
}
