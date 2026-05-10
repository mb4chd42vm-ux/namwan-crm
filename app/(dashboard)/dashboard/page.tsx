import Topbar from '@/components/layout/Topbar'
import PointsChart from '@/components/dashboard/PointsChart'
import type { PointsBarData } from '@/components/dashboard/PointsChart'
import { createClient } from '@/lib/supabase/server'
import { pts, fmt } from '@/data/mock'
import { SEGMENT_META, ALL_SEGMENTS, SEGMENT_COLOR, computeSegment, type Segment } from '@/lib/segments'
import { Users, Star, Gift, UserPlus, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function StatCard({
  label, value, sub, icon: Icon, color,
  trend,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
  trend?: { text: string; up?: boolean }
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trend.up !== false ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.up !== false && <ArrowUpRight size={12} />}
              {trend.text}
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params       = await searchParams
  const branchFilter = params.branch ?? null

  const supabase = await createClient()

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

  const [
    { data: branches },
    { data: allCustomers },
    { data: newTodayCustomers },
    { data: allTxs },
    { data: todayTxs },
    { data: monthlyCustomers },
  ] = await Promise.all([
    // Branches
    supabase
      .from('branches')
      .select('id, name, color_hex, sort_order')
      .eq('is_active', true)
      .order('sort_order'),

    // All active members (include fields needed for segment computation)
    supabase
      .from('customers')
      .select('id, name, home_branch_id, total_points, total_visits, last_visit_at, discovered_from, created_at')
      .eq('is_active', true),

    // New members registered today
    supabase
      .from('customers')
      .select('id')
      .eq('is_active', true)
      .gte('created_at', todayStart),

    // All points transactions for branch activity + segment computation
    supabase
      .from('points_transactions')
      .select('customer_id, branch_id, type, points, created_at'),

    // Today's points transactions
    supabase
      .from('points_transactions')
      .select('branch_id, type, points')
      .gte('created_at', todayStart),

    // Last 6 months members for growth chart
    supabase
      .from('customers')
      .select('created_at')
      .eq('is_active', true)
      .gte('created_at', sixMonthsAgo),
  ])

  const allBranches   = branches         ?? []
  const customers     = allCustomers     ?? []
  const todayCustomers = newTodayCustomers ?? []
  const txs           = allTxs           ?? []
  const txsToday      = todayTxs         ?? []
  const monthCusts    = monthlyCustomers ?? []

  // Apply branch filter to customers
  const filteredCustomers = branchFilter
    ? customers.filter(c => c.home_branch_id === branchFilter)
    : customers

  const filteredTxs = branchFilter
    ? txs.filter(t => t.branch_id === branchFilter)
    : txs

  const filteredTodayTxs = branchFilter
    ? txsToday.filter(t => t.branch_id === branchFilter)
    : txsToday

  // ── Key metrics ──────────────────────────────────────────────────────────────
  const totalMembers    = filteredCustomers.length
  const newMembersToday = branchFilter
    ? customers.filter(c => c.home_branch_id === branchFilter && new Date(c.created_at) >= new Date(todayStart)).length
    : todayCustomers.length

  const pointsClaimedToday = filteredTodayTxs
    .filter(t => t.type === 'earn')
    .reduce((s, t) => s + t.points, 0)

  const freeDrinksRedeemed = filteredTxs
    .filter(t => t.type === 'redeem')
    .length   // each redeem tx = 1 free drink

  const totalPointsOutstanding = filteredCustomers.reduce((s, c) => s + (c.total_points ?? 0), 0)

  // ── Compute segments from live data ──────────────────────────────────────────
  const redeemCountMap = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type === 'redeem') {
      const id = (tx as { customer_id: string; branch_id: string; type: string; points: number; created_at: string }).customer_id
      redeemCountMap.set(id, (redeemCountMap.get(id) ?? 0) + 1)
    }
  }

  const filteredWithSegment = filteredCustomers.map(c => ({
    ...c,
    computedSegment: computeSegment(
      { created_at: c.created_at, last_visit_at: c.last_visit_at ?? null, total_visits: c.total_visits ?? 0, total_points: c.total_points ?? 0 },
      redeemCountMap.get(c.id) ?? 0,
    ),
  }))

  // ── Segment distribution ──────────────────────────────────────────────────────
  const segmentCounts = ALL_SEGMENTS.map(s => ({
    segment: s,
    count:   filteredWithSegment.filter(c => c.computedSegment === s).length,
  }))

  // ── Points chart by branch ────────────────────────────────────────────────────
  const pointsChartData: PointsBarData[] = allBranches.map(b => ({
    name:     b.name.split(' ')[0],
    earned:   filteredTxs.filter(t => t.branch_id === b.id && t.type === 'earn').reduce((s, t) => s + t.points, 0),
    redeemed: filteredTxs.filter(t => t.branch_id === b.id && t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0),
    color:    b.color_hex,
  }))

  // ── Top branches by point activity ────────────────────────────────────────────
  const branchActivity = allBranches.map(b => {
    const earned   = filteredTxs.filter(t => t.branch_id === b.id && t.type === 'earn').reduce((s, t) => s + t.points, 0)
    const redeemed = filteredTxs.filter(t => t.branch_id === b.id && t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0)
    const members  = customers.filter(c => c.home_branch_id === b.id).length
    return { ...b, earned, redeemed, members, total: earned + redeemed }
  }).sort((a, b) => b.total - a.total)

  // ── Member growth (last 6 months) ─────────────────────────────────────────────
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return { label: d.toLocaleString('en-US', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() }
  })

  const growthData = monthLabels.map(({ label, year, month }) => ({
    label,
    count: monthCusts.filter(c => {
      const d = new Date(c.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    }).length,
  }))

  const maxGrowth = Math.max(...growthData.map(d => d.count), 1)

  // ── Acquisition source breakdown ──────────────────────────────────────────────
  const sourceLabels: Record<string, string> = {
    social_media: 'Social Media',
    friend:       'Friend Referral',
    walk_in:      'Walk-in',
    other:        'Other',
  }

  const sourceCounts = Object.entries(sourceLabels).map(([key, label]) => ({
    key,
    label,
    count: filteredCustomers.filter(c => c.discovered_from === key).length,
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count)

  const unknownCount = filteredCustomers.filter(c => !c.discovered_from).length

  // ── Top members by points ─────────────────────────────────────────────────────
  const topMembers = [...filteredWithSegment]
    .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))
    .slice(0, 6)

  const subtitle = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ' · Loyalty Overview'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Dashboard"
        subtitle={subtitle}
        branches={allBranches}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── Key metrics ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Members" value={fmt(totalMembers)}
            sub={`${filteredWithSegment.filter(c => c.computedSegment === 'top_fans').length} top fans`}
            icon={Users} color="bg-blue-50 text-blue-600"
            trend={{ text: `${newMembersToday} new today`, up: true }}
          />
          <StatCard
            label="New Today" value={fmt(newMembersToday)}
            sub="registered members"
            icon={UserPlus} color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Points Claimed Today" value={fmt(pointsClaimedToday)}
            sub="earned via QR"
            icon={Star} color="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Free Drinks Redeemed" value={fmt(freeDrinksRedeemed)}
            sub={`${fmt(totalPointsOutstanding)} pts outstanding`}
            icon={Gift} color="bg-purple-50 text-purple-600"
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

          {/* Member growth */}
          <div className="lg:col-span-3 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-[13px] font-semibold text-gray-900 mb-1">Member Growth</p>
            <p className="text-xs text-gray-400 mb-4">New members per month (last 6 months)</p>
            <div className="flex items-end gap-2 h-32">
              {growthData.map(({ label, count }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-gray-500">{count > 0 ? count : ''}</span>
                  <div
                    className="w-full rounded-t-md bg-brand-500 transition-all"
                    style={{ height: `${Math.round((count / maxGrowth) * 100)}%`, minHeight: count > 0 ? '4px' : '2px', opacity: count > 0 ? 1 : 0.15 }}
                  />
                  <span className="text-[10px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Segments */}
          <div className="lg:col-span-2 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-[13px] font-semibold text-gray-900 mb-1">Member Segments</p>
            <p className="text-xs text-gray-400 mb-4">Loyalty status distribution</p>
            {totalMembers === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No members yet</p>
            ) : (
              <div className="space-y-3">
                {segmentCounts.map(({ segment, count }) => {
                  const m   = SEGMENT_META[segment]
                  const pct = Math.round((count / totalMembers) * 100)
                  return (
                    <div key={segment} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                          <span className="font-medium text-gray-700">{m.label}</span>
                        </div>
                        <span className="text-gray-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: SEGMENT_COLOR[segment] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

          {/* Top branches by point activity */}
          <div className="lg:col-span-2 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Branch Activity</p>
                <p className="text-[11px] text-gray-400">By total points movement</p>
              </div>
              <Link href="/branches" className="text-[11px] text-brand-600 hover:underline">View all →</Link>
            </div>

            {/* Points chart */}
            <div className="mb-4">
              <PointsChart data={pointsChartData} />
            </div>

            {branchActivity.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-2.5">
                {branchActivity.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50 transition-colors">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: b.color_hex }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{b.name}</p>
                      <p className="text-[10px] text-gray-400">{b.members} members</p>
                    </div>
                    <div className="text-right text-[10px]">
                      <p className="font-semibold text-emerald-600">+{fmt(b.earned)} earned</p>
                      <p className="text-red-400">−{fmt(b.redeemed)} redeemed</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: top members + acquisition */}
          <div className="lg:col-span-3 space-y-4">

            {/* Top members by points */}
            <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">Top Members</p>
                  <p className="text-[11px] text-gray-400">By points balance</p>
                </div>
                <Link href="/customers" className="text-[11px] text-brand-600 hover:underline">View all →</Link>
              </div>
              {topMembers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No members yet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {topMembers.map((c, i) => {
                    const branch = allBranches.find(b => b.id === c.home_branch_id)
                    return (
                      <Link
                        key={c.id}
                        href={`/customers/${encodeURIComponent(c.id)}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-400">
                            {branch?.name ?? '—'}
                          </p>
                        </div>
                        {(() => {
                          const sm = SEGMENT_META[c.computedSegment as Segment]
                          return (
                            <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sm.bg} ${sm.color}`}>
                              <span className={`h-1 w-1 rounded-full ${sm.dot}`} />
                              {sm.label}
                            </span>
                          )
                        })()}
                        <div className="text-right">
                          <p className="text-xs font-bold text-amber-700">{pts(c.total_points ?? 0)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Acquisition source breakdown */}
            {(sourceCounts.length > 0 || unknownCount > 0) && (
              <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <p className="text-[13px] font-semibold text-gray-900 mb-1">How Members Found Us</p>
                <p className="text-xs text-gray-400 mb-4">Acquisition source from onboarding</p>
                <div className="space-y-2.5">
                  {[...sourceCounts, ...(unknownCount > 0 ? [{ key: 'unknown', label: 'Not specified', count: unknownCount }] : [])].map(s => {
                    const pct = Math.round((s.count / totalMembers) * 100)
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 font-medium">{s.label}</span>
                          <span className="text-gray-400">{s.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
