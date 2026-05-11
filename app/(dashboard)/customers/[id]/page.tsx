import Topbar from '@/components/layout/Topbar'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Calendar, Star, ShoppingBag,
  Hash, Clock, Cake, MessageSquare, TrendingUp,
  Pencil, Store, AlertTriangle, MapPin, Globe,
  User, Bell, BellOff, Heart,
} from 'lucide-react'
import RedeemPointsModal from '@/components/points/RedeemPointsModal'
import { TX_META, thb, pts, fmt, type TxType } from '@/data/mock'
import { SEGMENT_META, computeSegment, type Segment } from '@/lib/segments'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/lib/i18n'
import { getServerLang } from '@/lib/i18n/server'

// Always fetch fresh — never serve a stale/deleted customer from cache
export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const rawId     = (await params).id
  const id        = rawId.trim()          // trim any accidental whitespace
  const sp        = await searchParams
  const debugMode = sp.debug === '1'
  const lang      = await getServerLang()
  const t         = getDictionary(lang)

  // Log both raw and trimmed so we can spot encoding/whitespace issues
  console.log('[customer-detail] raw params.id :', JSON.stringify(rawId))
  console.log('[customer-detail] trimmed id     :', JSON.stringify(id))

  const supabase = await createClient()

  // customers → branches has TWO FKs (home_branch_id + favorite_branch_id), which
  // causes PGRST201 "ambiguous relationship" when embedding branches(...) directly.
  // Fix: select customer without branch embed, then fetch the home branch separately.
  const [
    { data: customer, error: customerErr },
    { data: purchases },
    { data: pointsTxs },
    { data: branches },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('*')              // no branches embed — avoids PGRST201
      .eq('id', id)            // exact match, no regex validation
      .single(),

    supabase
      .from('purchases')
      .select('id, purchased_at, total_amount, points_earned, staff_note, branch_id, purchase_items(name, quantity, unit_price), branches(id, name, color_hex)')
      .eq('customer_id', id)
      .order('purchased_at', { ascending: false }),

    supabase
      .from('points_transactions')
      .select('id, type, points, balance_after, note, created_at, branch_id, branches(id, name, color_hex)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('branches')
      .select('id, name, color_hex')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  console.log('[customer-detail] query result  :', customer ? `found (${customer.name})` : 'null')
  if (customerErr) {
    console.error('[customer-detail] query error  :', customerErr)
  }

  if (!customer) {
    // Always show debug panel when customer is null — never hide the error
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Customer not found" subtitle="" branches={branches ?? []} />
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-5 max-w-lg mx-auto w-full">
          {/* Debug panel — always visible when customer is null */}
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs font-mono space-y-1.5">
            <p className="font-bold text-yellow-800 text-[11px] uppercase tracking-wide mb-2">Debug info</p>
            <div><span className="text-yellow-600">raw params.id: </span><span className="text-yellow-900 break-all">{JSON.stringify(rawId)}</span></div>
            <div><span className="text-yellow-600">trimmed id:    </span><span className="text-yellow-900 break-all">{JSON.stringify(id)}</span></div>
            <div><span className="text-yellow-600">customer found: </span><span className="text-red-700 font-semibold">no</span></div>
            {customerErr
              ? <div><span className="text-yellow-600">Supabase error: </span><span className="text-red-700">{customerErr.message} (code: {customerErr.code})</span></div>
              : <div className="text-yellow-700">No Supabase error — row genuinely not in DB with this id</div>
            }
          </div>

          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-gray-900">Customer not found</p>
              <p className="text-sm text-gray-400">
                This customer may have been deleted, or the ID in the URL does not match any record.
              </p>
            </div>
            <Link
              href="/customers?debug=1"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Customers (debug on)
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Resolve branches from the branches list (no embed needed — avoids PGRST201)
  const homeBranch  = (branches ?? []).find(b => b.id === customer.home_branch_id)  ?? null
  const favBranch   = (branches ?? []).find(b => b.id === customer.favorite_branch_id) ?? null

  const DISCOVERED_LABELS: Record<string, string> = {
    social_media: t.memberDetail.discovered.social_media,
    friend:       t.memberDetail.discovered.friend,
    walk_in:      t.memberDetail.discovered.walk_in,
    other:        t.memberDetail.discovered.other,
  }
  const GENDER_LABELS: Record<string, string> = {
    male:              t.memberDetail.gender.male,
    female:            t.memberDetail.gender.female,
    non_binary:        t.memberDetail.gender.other,
    prefer_not_to_say: t.memberDetail.gender['prefer_not_to_say'],
    other:             t.memberDetail.gender.other,
  }

  const allPurchases = purchases ?? []
  const allTxs       = pointsTxs ?? []

  // Compute segment from live data — ignore the stored DB value
  const redeemCount = allTxs.filter(t => t.type === 'redeem').length
  const segment     = computeSegment(customer, redeemCount)
  const m           = SEGMENT_META[segment]

  const memberSince = new Date(customer.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const lastVisitStr = customer.last_visit_at
    ? new Date(customer.last_visit_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Never'

  const birthdayStr = customer.birthday
    ? new Date(customer.birthday + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long' })
    : null

  // Totals: prefer DB aggregates, fall back to calculated
  const calcSpending = allPurchases.reduce((s, p) => s + Number(p.total_amount), 0)
  const displaySpending = Number(customer.total_spending) > 0 ? Number(customer.total_spending) : calcSpending
  const displayPoints   = (customer.total_points ?? 0) > 0
    ? (customer.total_points ?? 0)
    : (allTxs.length > 0 ? allTxs[0].balance_after : 0)

  const avgSpend = customer.visit_count > 0
    ? Math.round(displaySpending / customer.visit_count)
    : 0

  // Branch breakdown
  interface BranchStats {
    id: string; name: string; color: string
    spending: number; visits: number; earned: number; redeemed: number
  }
  const branchMap = new Map<string, BranchStats>()

  for (const p of allPurchases) {
    const br = p.branches as unknown as { id: string; name: string; color_hex: string } | null
    if (!br) continue
    const existing = branchMap.get(br.id) ?? { id: br.id, name: br.name, color: br.color_hex, spending: 0, visits: 0, earned: 0, redeemed: 0 }
    existing.spending += Number(p.total_amount)
    existing.visits   += 1
    branchMap.set(br.id, existing)
  }

  for (const tx of allTxs) {
    const br = tx.branches as unknown as { id: string; name: string; color_hex: string } | null
    if (!br) continue
    const existing = branchMap.get(br.id) ?? { id: br.id, name: br.name, color: br.color_hex, spending: 0, visits: 0, earned: 0, redeemed: 0 }
    if (tx.type === 'earn')   existing.earned   += tx.points
    if (tx.type === 'redeem') existing.redeemed += Math.abs(tx.points)
    branchMap.set(br.id, existing)
  }

  const branchStats = Array.from(branchMap.values()).sort((a, b) => b.spending - a.spending)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title={customer.name}
        subtitle={t.memberDetail.title}
        branches={branches ?? []}
      />

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* ── Debug panel ── */}
        {debugMode && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs font-mono space-y-1.5">
            <p className="font-bold text-yellow-800 text-[11px] uppercase tracking-wide mb-2">
              Debug panel — ?debug=1
            </p>
            <div><span className="text-yellow-600">params.id: </span><span className="text-yellow-900 break-all">{id}</span></div>
            <div><span className="text-yellow-600">customer found: </span><span className={customer ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>{customer ? 'yes' : 'no'}</span></div>
            {customerErr && (
              <div><span className="text-yellow-600">Supabase error: </span><span className="text-red-700">{customerErr.message} (code: {customerErr.code})</span></div>
            )}
            {customer && (
              <>
                <div><span className="text-yellow-600">customer.id: </span><span className="text-yellow-900 break-all">{customer.id}</span></div>
                <div><span className="text-yellow-600">customer.name: </span><span className="text-yellow-900">{customer.name}</span></div>
                <div><span className="text-yellow-600">customer.phone: </span><span className="text-yellow-900">{customer.phone}</span></div>
                <div><span className="text-yellow-600">customer.is_active: </span><span className="text-yellow-900">{String(customer.is_active)}</span></div>
              </>
            )}
          </div>
        )}

        {/* Back + actions row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 text-xs text-cocoa-500 hover:text-cocoa-900 transition-colors"
          >
            <ArrowLeft size={13} /> {t.common.back}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <RedeemPointsModal
              customerId={id}
              customerName={customer.name}
              currentBalance={displayPoints}
              branches={branches ?? []}
              defaultBranchId={customer.home_branch_id ?? null}
            />
            <Link
              href={`/customers/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-200 hover:text-brand-700 transition-colors shadow-sm"
            >
              <Pencil size={11} /> Edit
            </Link>
          </div>
        </div>

        {/* ── Profile card ── */}
        <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Avatar */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white shadow-md">
              {customer.name.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name + segment badge */}
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.label}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-gray-600 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                <span className="flex items-center gap-1.5">
                  <Phone size={11} className="text-gray-400" />
                  {customer.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-gray-400" />
                  Member since {memberSince}
                </span>
                {homeBranch && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: homeBranch.color_hex }} />
                    {homeBranch.name}
                  </span>
                )}
                {birthdayStr && (
                  <span className="flex items-center gap-1.5 text-pink-600">
                    <Cake size={11} />
                    {birthdayStr}
                  </span>
                )}
                {customer.line_id && (
                  <span className="flex items-center gap-1.5 font-medium text-green-600">
                    <MessageSquare size={11} />
                    LINE: {customer.line_id}
                  </span>
                )}
              </div>

              {/* Notes */}
              {customer.notes && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                  <MessageSquare size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">{customer.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats row (loyalty metrics only) ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Points Balance',
              value: pts(displayPoints),
              icon: Star,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              border: 'border-amber-100',
            },
            {
              label: 'Total Visits',
              value: fmt(customer.visit_count ?? 0),
              icon: Hash,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              border: 'border-blue-100',
            },
            {
              label: 'Last Visit',
              value: lastVisitStr,
              icon: Clock,
              color: 'text-gray-600',
              bg: 'bg-gray-50',
              border: 'border-gray-100',
            },
          ].map(s => (
            <div
              key={s.label}
              className={`rounded-2xl border ${s.border} bg-white px-4 py-4 shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon size={12} className={s.color} />
                </div>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Profile Information ── */}
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-[13px] font-semibold text-gray-900">Profile Information</p>
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3.5">
            {/* Phone */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Phone size={11} className="text-gray-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Phone</p>
                <p className="text-xs font-medium text-gray-900">{customer.phone || '—'}</p>
              </div>
            </div>

            {/* Birthday */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-pink-50">
                <Cake size={11} className="text-pink-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Birthday</p>
                <p className="text-xs font-medium text-gray-900">{birthdayStr ?? '—'}</p>
              </div>
            </div>

            {/* Gender */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <User size={11} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Gender</p>
                <p className="text-xs font-medium text-gray-900">
                  {customer.gender ? (GENDER_LABELS[customer.gender] ?? customer.gender) : '—'}
                </p>
              </div>
            </div>

            {/* Area / Province */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <MapPin size={11} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Area / Province</p>
                <p className="text-xs font-medium text-gray-900">{customer.area_or_province || '—'}</p>
              </div>
            </div>

            {/* Region */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <Globe size={11} className="text-teal-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Region</p>
                <p className="text-xs font-medium text-gray-900">{customer.region || '—'}</p>
              </div>
            </div>

            {/* Favorite Branch */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
                <Heart size={11} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Favorite Branch</p>
                {favBranch ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-900">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: favBranch.color_hex }} />
                    {favBranch.name}
                  </span>
                ) : (
                  <p className="text-xs font-medium text-gray-900">—</p>
                )}
              </div>
            </div>

            {/* Discovered from */}
            <div className="flex items-start gap-2.5">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                <Star size={11} className="text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">How they found us</p>
                <p className="text-xs font-medium text-gray-900">
                  {customer.discovered_from
                    ? (DISCOVERED_LABELS[customer.discovered_from] ?? customer.discovered_from)
                    : '—'}
                </p>
              </div>
            </div>

            {/* Marketing consent */}
            <div className="flex items-start gap-2.5">
              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${customer.marketing_consent ? 'bg-green-50' : 'bg-gray-100'}`}>
                {customer.marketing_consent
                  ? <Bell size={11} className="text-green-500" />
                  : <BellOff size={11} className="text-gray-400" />
                }
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Marketing</p>
                {customer.marketing_consent === null || customer.marketing_consent === undefined ? (
                  <p className="text-xs font-medium text-gray-900">—</p>
                ) : customer.marketing_consent ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    Opted in
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    Opted out
                  </span>
                )}
              </div>
            </div>

            {/* LINE ID */}
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-green-50">
                <MessageSquare size={11} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">LINE User ID</p>
                <p className="text-xs font-medium text-gray-900 font-mono break-all">
                  {customer.line_id || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Branch Breakdown ── */}
        {branchStats.length > 0 && (
          <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 mb-4">
              <Store size={13} className="text-gray-400" />
              <p className="text-[13px] font-semibold text-gray-900">Branch Activity</p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {branchStats.map(bs => (
                <div
                  key={bs.id}
                  className="rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: bs.color }} />
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{bs.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div>
                      <p className="text-gray-400">Spending</p>
                      <p className="font-bold text-gray-800">{thb(bs.spending)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Visits</p>
                      <p className="font-bold text-gray-800">{bs.visits}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Earned</p>
                      <p className="font-bold text-emerald-600">+{fmt(bs.earned)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Redeemed</p>
                      <p className="font-bold text-red-500">{bs.redeemed > 0 ? `-${fmt(bs.redeemed)}` : '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Points history ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Points log — full width */}
          <div className="lg:col-span-3 rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-900">Points Log</p>
              <span className="text-[10px] text-gray-400">{allTxs.length} event{allTxs.length !== 1 ? 's' : ''}</span>
            </div>

            {allTxs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10">
                <Star size={28} className="text-gray-200" />
                <p className="text-xs text-gray-400">No transactions yet</p>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-96">
                  {allTxs.map(tx => {
                    const txm      = TX_META[tx.type as TxType]
                    const txBranch = tx.branches as unknown as { name: string; color_hex: string } | null
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold flex-shrink-0 ${txm.bg} ${txm.color}`}>
                          {txm.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-600 truncate">{tx.note ?? '—'}</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-gray-400">
                            {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                            {txBranch && (
                              <>
                                <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: txBranch.color_hex }} />
                                {txBranch.name.split(' ')[0]}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.points > 0 ? '+' : ''}{tx.points}
                          </p>
                          <p className="text-[9px] text-gray-400">{fmt(tx.balance_after)} bal</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Current Balance</span>
                  <span className="text-sm font-bold text-amber-700">{pts(displayPoints)}</span>
                </div>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
