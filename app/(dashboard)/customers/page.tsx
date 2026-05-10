import Topbar from '@/components/layout/Topbar'
import CustomerSearch from '@/components/customers/CustomerSearch'
import AddCustomerModal from '@/components/customers/AddCustomerModal'
import CustomerTableBody from '@/components/customers/CustomerTableBody'
import ExportMembersButton from '@/components/customers/ExportMembersButton'
import Link from 'next/link'
import { Suspense } from 'react'
import { Users, AlertCircle } from 'lucide-react'
import { pts, fmt } from '@/data/mock'
import { SEGMENT_META, ALL_SEGMENTS, computeSegment, type Segment } from '@/lib/segments'
import { createClient } from '@/lib/supabase/server'

// Always fetch fresh — prevents stale cache from showing deleted/outdated rows
export const dynamic = 'force-dynamic'

const TABS: { value: string; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'top_fans',       label: 'Top Fans' },
  { value: 'loyal',          label: 'Loyal' },
  { value: 'high_potential', label: 'High Potential' },
  { value: 'new_member',     label: 'New' },
  { value: 'active',         label: 'Active' },
  { value: 'inactive',       label: 'Inactive' },
]

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params       = await searchParams
  const seg          = (params.segment ?? 'all') as Segment | 'all'
  const branchFilter = params.branch ?? null
  const q            = params.q ?? ''
  const debugMode    = params.debug === '1'

  const supabase = await createClient()

  // Build base query — no segment filter (segments are computed, not stored)
  let baseQ = supabase
    .from('customers')
    .select('id, name, phone, home_branch_id, total_points, visit_count, last_visit_at, created_at')
    .eq('is_active', true)
    .order('total_points', { ascending: false })

  if (q.trim()) {
    baseQ = baseQ.or(`name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`)
  }
  if (branchFilter) {
    baseQ = baseQ.eq('home_branch_id', branchFilter)
  }

  // Fire all queries in parallel
  const [
    { data: branches,   error: branchErr },
    { data: customers,  error: custErr   },
    { data: redeemTxs },
  ] = await Promise.all([
    supabase.from('branches').select('id, name, color_hex').eq('is_active', true).order('sort_order'),
    baseQ,
    supabase.from('points_transactions').select('customer_id').eq('type', 'redeem'),
  ])

  if (branchErr) console.error('[customers] branches query error:', branchErr)
  if (custErr)   console.error('[customers] customers query error:', custErr)

  // Build redeem count map
  const redeemCountMap = new Map<string, number>()
  for (const tx of redeemTxs ?? []) {
    const id = (tx as { customer_id: string }).customer_id
    redeemCountMap.set(id, (redeemCountMap.get(id) ?? 0) + 1)
  }

  // Compute segment for each customer (DB uses visit_count; computeSegment expects total_visits)
  const allWithSegment = (customers ?? []).map(c => ({
    ...c,
    computedSegment: computeSegment(
      { ...c, total_visits: c.visit_count ?? 0 },
      redeemCountMap.get(c.id) ?? 0,
    ),
  }))

  console.log(`[customers] loaded ${allWithSegment.length} customers (mock: 0)`)

  // Apply segment tab filter
  const filtered = seg === 'all'
    ? allWithSegment
    : allWithSegment.filter(c => c.computedSegment === seg)

  // Tab counts (before segment filter, after search/branch filter)
  const segCounts = Object.fromEntries(
    ['all', ...ALL_SEGMENTS].map(s => [
      s,
      s === 'all'
        ? allWithSegment.length
        : allWithSegment.filter(c => c.computedSegment === s).length,
    ])
  )

  const hasError = !!custErr

  // Summary stats
  const totalPoints = filtered.reduce((s, c) => s + (c.total_points ?? 0), 0)
  const avgVisits   = filtered.length > 0
    ? (filtered.reduce((s, c) => s + (c.visit_count ?? 0), 0) / filtered.length).toFixed(1)
    : '0'

  function buildTabHref(value: string) {
    const p = new URLSearchParams()
    if (value !== 'all') p.set('segment', value)
    if (branchFilter)    p.set('branch', branchFilter)
    if (q)               p.set('q', q)
    const qs = p.toString()
    return `/customers${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Members"
        subtitle={`${fmt(allWithSegment.length)} members · shared loyalty across all branches`}
        branches={branches ?? []}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* ── Error banner ── */}
        {hasError && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">
              Could not load member data. Check your Supabase credentials in <code className="font-mono bg-red-100 px-1 rounded">.env.local</code>.
            </p>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Segment tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-white border border-gray-100 shadow-sm p-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <Link
                key={t.value}
                href={buildTabHref(t.value)}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  seg === t.value
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                  seg === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {segCounts[t.value] ?? 0}
                </span>
              </Link>
            ))}
          </div>

          {/* Search + Add + Export */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Suspense fallback={<div className="h-9 flex-1 rounded-xl bg-gray-100 animate-pulse" />}>
              <CustomerSearch defaultValue={q} />
            </Suspense>
            <AddCustomerModal />
            <ExportMembersButton />
          </div>
        </div>

        {/* ── Result count ── */}
        {(q || seg !== 'all' || branchFilter) && (
          <p className="text-[11px] text-gray-400">
            {filtered.length === 0
              ? 'No members match your filters'
              : `Showing ${filtered.length} member${filtered.length !== 1 ? 's' : ''}${q ? ` for "${q}"` : ''}${seg !== 'all' ? ` · ${SEGMENT_META[seg as Segment]?.label ?? seg}` : ''}`
            }
          </p>
        )}

        {/* ── Table ── */}
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} className="text-gray-200" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400">
                  {hasError ? 'Could not load members' : 'No members yet'}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {hasError
                    ? 'Database connection error — check Supabase credentials'
                    : q
                    ? `No results for "${q}" — try a different search`
                    : seg !== 'all'
                    ? `No ${SEGMENT_META[seg as Segment]?.label ?? seg} members${branchFilter ? ' at this branch' : ''}`
                    : 'Add your first member using the button above'}
                </p>
              </div>
              {!hasError && !q && seg === 'all' && <AddCustomerModal />}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Member</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Segment</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Branch</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Points</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Visits</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Last Visit</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <CustomerTableBody
                  customers={filtered.map(c => ({
                    id:             c.id,
                    name:           c.name,
                    phone:          c.phone,
                    segment:        c.computedSegment,
                    home_branch_id: c.home_branch_id,
                    total_points:   c.total_points ?? 0,
                    visit_count:    c.visit_count ?? 0,
                    last_visit_at:  c.last_visit_at,
                    branch:         (branches ?? []).find(b => b.id === c.home_branch_id) ?? null,
                  }))}
                  query={q}
                />
              </table>
            </div>
          )}
        </div>

        {/* ── Debug panel ── */}
        {debugMode && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs font-mono space-y-3">
            <p className="font-bold text-yellow-800 text-[11px] uppercase tracking-wide">
              Debug — ?debug=1 — {filtered.length} row(s) · seg={seg}
            </p>
            {custErr && (
              <p className="text-red-700 font-semibold">Supabase error: {custErr.message} (code: {custErr.code})</p>
            )}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-yellow-300 text-yellow-700">
                  <th className="text-left py-1 pr-4 font-semibold">#</th>
                  <th className="text-left py-1 pr-4 font-semibold">id</th>
                  <th className="text-left py-1 pr-4 font-semibold">name</th>
                  <th className="text-left py-1 pr-4 font-semibold">phone</th>
                  <th className="text-left py-1 font-semibold">segment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-2 text-yellow-600 italic">No members returned</td></tr>
                ) : (
                  filtered.map((c, i) => (
                    <tr key={c.id} className="border-b border-yellow-100">
                      <td className="py-1 pr-4 text-yellow-500">{i + 1}</td>
                      <td className="py-1 pr-4 text-yellow-900 break-all">{c.id}</td>
                      <td className="py-1 pr-4 text-yellow-900">{c.name ?? '—'}</td>
                      <td className="py-1 pr-4 text-yellow-900">{c.phone ?? '—'}</td>
                      <td className="py-1 text-yellow-900">{c.computedSegment}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Summary stats ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Total Members', value: fmt(filtered.length) },
              { label: 'Total Points',  value: pts(totalPoints) },
              { label: 'Avg. Visits',   value: avgVisits },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white border border-gray-100 px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
