import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/branches
 *
 * Public list of active branches for LIFF onboarding.
 */
export async function GET() {
  const db = adminClient()

  const { data, error } = await db
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branches: data ?? [] })
}
