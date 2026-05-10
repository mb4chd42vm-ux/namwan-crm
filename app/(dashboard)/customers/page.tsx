import Topbar from '@/components/layout/Topbar'
import CustomerSearch from '@/components/customers/CustomerSearch'
import AddCustomerModal from '@/components/customers/AddCustomerModal'
import CustomerTableBody from '@/components/customers/CustomerTableBody'
import Link from 'next/link'
import { Suspense } from 'react'
import { Phone, Star, Users, ChevronRight, AlertCircle } from 'lucide-react'
import { SEGMENT_META, thb, pts, fmt, type Segment } from '@/data/mock'
import { createClient } from '@/lib/supabase/server'

const TABS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'vip',       label: 'VIP' },
  { value: 'returning', label: 'Returning' },
  { value: 'new',       label: 'New' },
  { value: 'inactive',  label: 'Inactive' },
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

  const supabase = await createClient()

  // ── Build both customer queries (but don't await yet) ──────────────────────
  let filteredQ = supabase
    .from('customers')
    .select('id, name, phone, segment, home_branch_id, total_spending, total_points, visit_count, last_visit_at')
    .eq('is_active', true)
    .order('total_spending', { ascending: false })

  let countsQ = supabase
    .from('customers')
    .select('segment')
    .eq('is_active', true)

  if (q.trim()) {
    filteredQ = filteredQ.or(`name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`)
    countsQ   = countsQ.or(`name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`)
  }
  if (branchFilter) {
    filteredQ = filteredQ.eq('home_branch_id', branchFilter)
    countsQ   = countsQ.eq('home_branch_id', branchFilter)
  }
  if (seg !== 'all') {
    filteredQ = filteredQ.eq('segment', seg)
  }

  // ── Fire all three queries in parallel ────────────────────────────────────
  const [
    { data: branches,      error: branchErr },
    { data: customers,     error: custErr   },
    { data: allForCounts,  error: countErr  },
  ] = await Promise.all([
    supabase.from('branches').select('id, name, color_hex').eq('is_active', true).order('sort_order'),
    filteredQ,
    countsQ,
  ])

  // Log any Supabase errors for debugging (warn avoids Next.js error overlay)
  if (branchErr) console.warn('[customers] branches error:', branchErr)
  if (custErr)   console.warn('[customers] customers error:', custErr)
  if (countErr)  console.warn('[customers] counts error:',   countErr)

  const hasError   = !!(custErr || countErr)
  const allCounts  = allForCounts ?? []
  const filtered   = customers    ?? []

  const segCounts = Object.fromEntries(
    ['all', 'vip', 'returning', 'new', 'inactive'].map(s => [
      s,
      s === 'all' ? allCounts.length : allCounts.filter(c => c.segment === s).length,
    ])
  )

  // Summary stats of visible rows
  const totalSpending = filtered.reduce((s, c) => s + Number(c.total_spending), 0)
  const totalPoints   = filtered.reduce((s, c) => s + c.total_points, 0)
  const avgSpending   = filtered.length > 0 ? Math.round(totalSpending / filtered.length) : 0
  const avgVisits     = filtered.length > 0
    ? (filtered.reduce((s, c) => s + c.visit_count, 0) / filtered.length).toFixed(1)
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
        title="Customers"
        subtitle={`${fmt(allCounts.length)} members · shared loyalty across all branches`}
        branches={branches ?? []}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* ── Error banner ── */}
        {hasError && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">
              Could not load customer data. Check your Supabase credentials in <code className="font-mono bg-red-100 px-1 rounded">.env.local</code> and ensure the service role key is set.
            </p>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Segment tabs — scrollable on mobile */}
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
                  {segCounts[t.value]}
                </span>
              </Link>
            ))}
          </div>

          {/* Search + Add */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Suspense fallback={<div className="h-9 flex-1 rounded-xl bg-gray-100 animate-pulse" />}>
              <CustomerSearch defaultValue={q} />
            </Suspense>
            <AddCustomerModal />
          </div>
        </div>

        {/* ── Result count ── */}
        {(q || seg !== 'all' || branchFilter) && (
          <p className="text-[11px] text-gray-400">
            {filtered.length === 0
              ? 'No customers match your filters'
              : `Showing ${filtered.length} customer${filtered.length !== 1 ? 's' : ''}${q ? ` for "${q}"` : ''}`
            }
          </p>
        )}

        {/* ── Table ── */}
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} className="text-gray-200" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400">No customers found</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {hasError
                    ? 'Database connection error — check credentials'
                    : q
                    ? `No results for "${q}" — try a different search`
                    : 'Add your first customer using the button above'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Segment</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Branch</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">Points</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden md:table-cell">Total Spent</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Visits</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hidden lg:table-cell">Last Visit</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <CustomerTableBody
                  customers={filtered.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    segment: c.segment,
                    home_branch_id: c.home_branch_id,
                    total_points: c.total_points ?? 0,
                    total_spending: Number(c.total_spending ?? 0),
                    visit_count: c.visit_count ?? 0,
                    last_visit_at: c.last_visit_at,
                    branch: (branches ?? []).find(b => b.id === c.home_branch_id) ?? null,
                  }))}
                  query={q}
                />
              </table>
            </div>
          )}
        </div>

        {/* ── Summary stats ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Spending', value: thb(totalSpending) },
              { label: 'Total Points',   value: pts(totalPoints) },
              { label: 'Avg. Spending',  value: thb(avgSpending) },
              { label: 'Avg. Visits',    value: avgVisits },
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

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-100 text-brand-800 rounded px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
