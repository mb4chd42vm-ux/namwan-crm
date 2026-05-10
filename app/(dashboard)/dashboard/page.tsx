import Topbar from '@/components/layout/Topbar'
import SalesChart from '@/components/dashboard/SalesChart'
import type { Branch as ChartBranch } from '@/components/dashboard/SalesChart'
import PointsChart from '@/components/dashboard/PointsChart'
import type { PointsBarData } from '@/components/dashboard/PointsChart'
import { createClient } from '@/lib/supabase/server'
import { SEGMENT_META, thb, pts, fmt, type Segment } from '@/data/mock'
import {
  Users, ShoppingBag, Star, UserCheck,
  ArrowUpRight, ArrowDownRight, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
  trend?: { up: boolean; text: string }
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
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

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8 text-center text-xs text-gray-400">No data yet</td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params       = await searchParams
  const branchFilter = params.branch ?? null

  const supabase = await createClient()

  // Date boundaries
  const now           = new Date()
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const sixMonthsAgo  = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [
    { data: branches },
    { data: customers },
    { data: recentPurchases },
    { data: chartPurchases },
    { data: allPurchases },
    { data: prevMonthPurchases },
    { data: pointsTxs },
  ] = await Promise.all([
    // Branches
    supabase
      .from('branches')
      .select('id, name, location, color_hex, sort_order')
      .eq('is_active', true)
      .order('sort_order'),

    // All customers (for segment counts, top customers, repeat)
    supabase
      .from('customers')
      .select('id, name, phone, segment, home_branch_id, total_spending, total_points, visit_count')
      .eq('is_active', true),

    // Recent 6 purchases for the table (branch filter applied in query)
    supabase
      .from('purchases')
      .select('id, purchased_at, total_amount, points_earned, customers(name), branches(name, color_hex), purchase_items(name)')
      .order('purchased_at', { ascending: false })
      .limit(6),

    // Last 6 months of purchases for the sales chart
    supabase
      .from('purchases')
      .select('purchased_at, total_amount, branch_id')
      .gte('purchased_at', sixMonthsAgo.toISOString()),

    // ALL-TIME purchases for total revenue & branch performance
    supabase
      .from('purchases')
      .select('branch_id, total_amount, customer_id'),

    // Previous month purchases for trend comparison
    supabase
      .from('purchases')
      .select('total_amount, branch_id')
      .gte('purchased_at', prevMonthStart.toISOString())
      .lt('purchased_at', monthStart.toISOString()),

    // All points transactions for issued/redeemed totals and chart
    supabase
      .from('points_transactions')
      .select('branch_id, type, points'),
  ])

  // ── Customer filtering ─────────────────────────────────────────────────────
  const allCustomers      = customers ?? []
  const filteredCustomers = branchFilter
    ? allCustomers.filter(c => c.home_branch_id === branchFilter)
    : allCustomers

  // ── Customer segment stats ─────────────────────────────────────────────────
  const totalCustomers   = filteredCustomers.length
  const vipCount         = filteredCustomers.filter(c => c.segment === 'vip').length
  const inactiveCount    = filteredCustomers.filter(c => c.segment === 'inactive').length
  const repeatCustomers  = filteredCustomers.filter(c => c.visit_count > 1).length

  // ── Revenue stats ──────────────────────────────────────────────────────────
  const allTime = (allPurchases ?? []).filter(p => !branchFilter || p.branch_id === branchFilter)
  const totalAllTimeSales = allTime.reduce((s, p) => s + Number(p.total_amount), 0)

  const thisMonthlySales = (chartPurchases ?? [])
    .filter(p => {
      const inBranch = !branchFilter || p.branch_id === branchFilter
      return inBranch && new Date(p.purchased_at) >= monthStart
    })
    .reduce((s, p) => s + Number(p.total_amount), 0)

  const prevMonthlySales = (prevMonthPurchases ?? [])
    .filter(p => !branchFilter || p.branch_id === branchFilter)
    .reduce((s, p) => s + Number(p.total_amount), 0)

  const revenueVsPrev = prevMonthlySales > 0
    ? Math.round(((thisMonthlySales - prevMonthlySales) / prevMonthlySales) * 100)
    : null

  // ── Points stats ───────────────────────────────────────────────────────────
  const allTxs = (pointsTxs ?? []).filter(t => !branchFilter || t.branch_id === branchFilter)
  const totalPointsIssued   = allTxs.filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0)
  const totalPointsRedeemed = allTxs.filter(t => t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0)
  const totalPointsBalance  = filteredCustomers.reduce((s, c) => s + c.total_points, 0)

  // ── Segment distribution ───────────────────────────────────────────────────
  const segmentCounts = (['new', 'returning', 'vip', 'inactive'] as Segment[]).map(s => ({
    segment: s,
    count: filteredCustomers.filter(c => c.segment === s).length,
  }))

  // ── Sales chart data (keyed by branch ID for dynamic rendering) ────────────
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return d.toLocaleString('en-US', { month: 'short' })
  })

  const monthMap = new Map<string, Record<string, number | string>>(
    monthLabels.map(m => [m, { month: m }])
  )

  for (const p of chartPurchases ?? []) {
    if (branchFilter && p.branch_id !== branchFilter) continue
    const label = new Date(p.purchased_at).toLocaleString('en-US', { month: 'short' })
    const entry = monthMap.get(label)
    if (entry) {
      entry[p.branch_id] = (Number(entry[p.branch_id] ?? 0)) + Number(p.total_amount)
    }
  }

  const monthlySalesData = Array.from(monthMap.values())
  const chartBranches: ChartBranch[] = (branches ?? []).map(b => ({
    id: b.id,
    name: b.name,
    color_hex: b.color_hex,
  }))

  // ── Points chart data ──────────────────────────────────────────────────────
  const pointsChartData: PointsBarData[] = (branches ?? []).map(b => ({
    name:     b.name.split(' ')[0],
    earned:   allTxs.filter(t => t.branch_id === b.id && t.type === 'earn').reduce((s, t) => s + t.points, 0),
    redeemed: allTxs.filter(t => t.branch_id === b.id && t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0),
    color:    b.color_hex,
  }))

  // ── Top customers ──────────────────────────────────────────────────────────
  const topCustomers = [...filteredCustomers]
    .sort((a, b) => b.total_spending - a.total_spending)
    .slice(0, 6)

  // ── Branch performance (all-time) ──────────────────────────────────────────
  const branchPerf = (branches ?? []).map(b => {
    const bPurchases = (allPurchases ?? []).filter(p => p.branch_id === b.id)
    const uniqueCustomers = new Set(bPurchases.map(p => p.customer_id)).size
    return {
      ...b,
      sales:     bPurchases.reduce((s, p) => s + Number(p.total_amount), 0),
      orders:    bPurchases.length,
      custCount: uniqueCustomers,
    }
  }).sort((a, b) => b.sales - a.sales)

  const subtitle = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }) + ' overview'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Dashboard"
        subtitle={subtitle}
        branches={branches ?? []}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Customers" value={fmt(totalCustomers)}
            sub={`${repeatCustomers} repeat · ${inactiveCount} inactive`}
            icon={Users} color="bg-blue-50 text-blue-600"
            trend={{ up: true, text: `${Math.round((repeatCustomers / Math.max(totalCustomers, 1)) * 100)}% repeat rate` }}
          />
          <StatCard
            label="Monthly Revenue" value={thb(thisMonthlySales)}
            sub={prevMonthlySales > 0 ? `vs ${thb(prevMonthlySales)} last month` : 'This month'}
            icon={ShoppingBag} color="bg-brand-50 text-brand-600"
            trend={revenueVsPrev !== null
              ? { up: revenueVsPrev >= 0, text: `${revenueVsPrev >= 0 ? '+' : ''}${revenueVsPrev}% vs last month` }
              : undefined
            }
          />
          <StatCard
            label="All-time Revenue" value={thb(totalAllTimeSales)}
            sub={`${fmt((allPurchases ?? []).filter(p => !branchFilter || p.branch_id === branchFilter).length)} total orders`}
            icon={TrendingUp} color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Points Outstanding" value={fmt(totalPointsBalance)}
            sub={`${fmt(totalPointsIssued)} issued · ${fmt(totalPointsRedeemed)} redeemed`}
            icon={Star} color="bg-amber-50 text-amber-600"
            trend={{ up: true, text: `${fmt(vipCount)} VIP members` }}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Sales chart */}
          <div className="lg:col-span-3 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Sales by Branch</p>
                <p className="text-xs text-gray-400">Last 6 months</p>
              </div>
              <div className="flex gap-3 text-[10px]">
                {(branches ?? []).map(b => (
                  <div key={b.id} className="flex items-center gap-1.5 text-gray-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: b.color_hex }} />
                    {b.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>
            <SalesChart data={monthlySalesData} branches={chartBranches} />
          </div>

          {/* Segments + points chart */}
          <div className="lg:col-span-2 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="mb-1 text-[13px] font-semibold text-gray-900">Customer Segments</p>
            <p className="mb-4 text-xs text-gray-400">Distribution by loyalty status</p>

            {totalCustomers === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No customers yet</p>
            ) : (
              <div className="space-y-3">
                {segmentCounts.map(({ segment, count }) => {
                  const m   = SEGMENT_META[segment]
                  const pct = Math.round((count / totalCustomers) * 100)
                  return (
                    <div key={segment} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                          <span className="font-medium text-gray-700">{m.label}</span>
                        </div>
                        <span className="text-gray-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              segment === 'vip'       ? '#d97519' :
                              segment === 'returning' ? '#16a34a' :
                              segment === 'new'       ? '#2563eb' : '#9ca3af',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Points by Branch</p>
                <div className="flex gap-2 text-[9px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-gray-400 opacity-90"/>Issued</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-sm bg-gray-400 opacity-35"/>Redeemed</span>
                </div>
              </div>
              <PointsChart data={pointsChartData} />
            </div>
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Branch performance */}
          <div className="lg:col-span-2 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Branch Performance</p>
                <p className="text-[11px] text-gray-400">All-time revenue</p>
              </div>
              <Link href="/branches" className="text-[11px] text-brand-600 hover:underline">View all →</Link>
            </div>
            {branchPerf.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No branches found</p>
            ) : (
              <div className="space-y-3">
                {branchPerf.map((b, i) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: b.color_hex }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{b.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{b.orders} orders · {b.custCount} customers</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900">{thb(b.sales)}</p>
                      <p className="text-[10px] text-gray-400">
                        {totalAllTimeSales > 0 ? Math.round((b.sales / totalAllTimeSales) * 100) : 0}% of total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top customers */}
          <div className="lg:col-span-3 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Top Customers</p>
                <p className="text-[11px] text-gray-400">By all-time spending</p>
              </div>
              <Link href="/customers" className="text-[11px] text-brand-600 hover:underline">View all →</Link>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No customers yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {topCustomers.map((c, i) => {
                  const m      = SEGMENT_META[c.segment as Segment]
                  const branch = (branches ?? []).find(b => b.id === c.home_branch_id)
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
                          {branch?.name ?? '—'} · {c.visit_count} visits
                        </p>
                      </div>
                      <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.bg} ${m.color}`}>
                        <span className={`h-1 w-1 rounded-full ${m.dot}`} />
                        {m.label}
                      </span>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-900">{thb(c.total_spending)}</p>
                        <p className="text-[10px] text-amber-600">{pts(c.total_points)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent purchases ── */}
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-gray-900">Recent Purchases</p>
            <Link href="/purchases" className="text-[11px] text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Customer', 'Branch', 'Items', 'Amount', 'Points', 'Date'].map(h => (
                    <th key={h} className="pb-2 text-left font-semibold text-gray-400 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(recentPurchases ?? []).length === 0 ? (
                  <EmptyRow cols={6} />
                ) : (
                  (recentPurchases ?? []).map(p => {
                    const cust   = p.customers as unknown as { name: string } | null
                    const branch = p.branches  as unknown as { name: string; color_hex: string } | null
                    const items  = p.purchase_items as unknown as { name: string }[] | null ?? []
                    const itemStr = items.map(i => i.name).join(', ')
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                              {cust?.name.charAt(0) ?? '?'}
                            </div>
                            <span className="font-medium text-gray-800">{cust?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          {branch ? (
                            <span
                              className="rounded-lg px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ background: branch.color_hex }}
                            >
                              {branch.name}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500 max-w-[180px] truncate">
                          {itemStr || '—'}
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-gray-900">{thb(Number(p.total_amount))}</td>
                        <td className="py-2.5 pr-4 text-emerald-600 font-medium">+{p.points_earned} pts</td>
                        <td className="py-2.5 text-gray-400">
                          {new Date(p.purchased_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
