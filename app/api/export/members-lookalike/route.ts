import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { computeSegment, SEGMENT_META, type Segment } from '@/lib/segments'

const LABEL = '[export-members]'

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession()

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized — please log in' }, { status: 401 })
    }

    const { role } = session.profile
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json(
        { error: 'Forbidden — admin or manager role required' },
        { status: 403 },
      )
    }

    const allMembers    = request.nextUrl.searchParams.get('all') === '1'
    const segmentFilter = request.nextUrl.searchParams.get('segment') ?? null
    console.log(`${LABEL} export by ${session.profile.name} (${role}), all=${allMembers}, segment=${segmentFilter}`)

    const supabase = await createClient()

    let query = supabase
      .from('customers')
      .select(
        'id, name, phone, birthday, gender, area_or_province, region, home_branch_id, favorite_branch_id, discovered_from, marketing_consent, total_points, visit_count, last_visit_at, created_at, line_id',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!allMembers) {
      query = query.eq('marketing_consent', true)
    }

    const [{ data: customers, error }, { data: branches }, { data: redeemTxs }] = await Promise.all([
      query,
      supabase.from('branches').select('id, name').eq('is_active', true),
      supabase.from('points_transactions').select('customer_id').eq('type', 'redeem'),
    ])

    if (error) {
      console.error(`${LABEL} query error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const branchMap = new Map((branches ?? []).map(b => [b.id, b.name]))

    // Build redeem count map for segment computation
    const redeemCountMap = new Map<string, number>()
    for (const tx of redeemTxs ?? []) {
      const id = (tx as { customer_id: string }).customer_id
      redeemCountMap.set(id, (redeemCountMap.get(id) ?? 0) + 1)
    }

    // Compute segment and optionally filter by segment
    let rows_data = (customers ?? []).map(c => ({
      ...c,
      computedSegment: computeSegment(
        { created_at: c.created_at, last_visit_at: c.last_visit_at ?? null, total_visits: c.visit_count ?? 0, total_points: c.total_points ?? 0 },
        redeemCountMap.get(c.id) ?? 0,
      ),
    }))

    if (segmentFilter) {
      rows_data = rows_data.filter(c => c.computedSegment === segmentFilter)
    }

    const headers = [
      'full_name',
      'phone',
      'birthday',
      'gender',
      'area_or_province',
      'region',
      'most_visit_branch',
      'discovered_from',
      'segment',
      'marketing_consent',
      'points_balance',
      'total_visits',
      'created_at',
      'line_id',
    ]

    const rows = rows_data.map(c => [
      c.name ?? '',
      formatPhone(c.phone ?? ''),
      c.birthday ?? '',
      c.gender ?? '',
      c.area_or_province ?? '',
      c.region ?? '',
      branchMap.get(c.favorite_branch_id ?? '') ??
        branchMap.get(c.home_branch_id ?? '') ??
        '',
      c.discovered_from ?? '',
      SEGMENT_META[c.computedSegment as Segment]?.label ?? c.computedSegment,
      c.marketing_consent ? 'yes' : 'no',
      String(c.total_points ?? 0),
      String(c.visit_count ?? 0),
      c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
      c.line_id ?? '',
    ])

    const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(',')).join('\r\n')

    console.log(`${LABEL} exported ${rows.length} rows`)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="namwan-members-lookalike.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(`${LABEL} unhandled error:`, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
