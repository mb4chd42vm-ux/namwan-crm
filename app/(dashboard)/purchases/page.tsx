import Topbar from '@/components/layout/Topbar'
import AddPurchaseModal from '@/components/purchases/AddPurchaseModal'
import { ShoppingBag } from 'lucide-react'
import { SEGMENT_META, thb, fmt, type Segment } from '@/data/mock'
import { createClient } from '@/lib/supabase/server'

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params       = await searchParams
  const branchFilter = params.branch ?? null

  const supabase = await createClient()

  const [{ data: branches }, { data: purchases }, { data: customers }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, color_hex')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('purchases')
      .select(`
        id, purchased_at, total_amount, points_earned, staff_note,
        customers ( id, name, segment ),
        branches  ( id, name, color_hex ),
        purchase_items ( name, quantity, unit_price )
      `)
      .order('purchased_at', { ascending: false }),

    supabase
      .from('customers')
      .select('id, name, phone')
      .eq('is_active', true)
      .order('name'),
  ])

  const allPurchases = purchases ?? []

  const filtered = branchFilter
    ? allPurchases.filter(p => {
        const b = p.branches as unknown as { id: string } | null
        return b?.id === branchFilter
      })
    : allPurchases

  // Aggregate stats from filtered set
  const totalRevenue = filtered.reduce((s, p) => s + Number(p.total_amount), 0)
  const totalPts     = filtered.reduce((s, p) => s + p.points_earned, 0)
  const avgOrder     = filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Purchases"
        subtitle={`${fmt(allPurchases.length)} transactions recorded`}
        branches={branches ?? []}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Transactions', value: fmt(filtered.length) },
            { label: 'Total Revenue',      value: thb(totalRevenue) },
            { label: 'Points Issued',      value: fmt(totalPts) + ' pts' },
            { label: 'Avg Order Value',    value: thb(avgOrder) },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white border border-gray-100 px-4 py-3 shadow-sm">
              <p className="text-[10px] text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-700">All Transactions</p>
          <AddPurchaseModal
            customers={customers ?? []}
            branches={branches ?? []}
            defaultBranchId={branchFilter}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Date', 'Customer', 'Branch', 'Items', 'Amount', 'Points Earned', 'Note'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingBag size={28} className="text-gray-200" />
                      <p className="text-xs font-medium text-gray-400">No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const cust   = p.customers     as unknown as { name: string; segment: string } | null
                  const branch = p.branches      as unknown as { name: string; color_hex: string } | null
                  const items  = p.purchase_items as unknown as { name: string; quantity: number }[] | null ?? []
                  const m      = cust?.segment ? SEGMENT_META[cust.segment as Segment] : null
                  const dateStr = new Date(p.purchased_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dateStr}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                            {cust?.name.charAt(0) ?? '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{cust?.name ?? '—'}</p>
                            {m && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0 text-[9px] font-medium ${m.bg} ${m.color}`}>
                                <span className={`h-1 w-1 rounded-full ${m.dot}`} />{m.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {branch ? (
                          <span
                            className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ background: branch.color_hex }}
                          >
                            {branch.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                        {items.map(i => `${i.name} ×${i.quantity}`).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">{thb(Number(p.total_amount))}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-600">+{p.points_earned} pts</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 italic text-[10px]">
                        {p.staff_note ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  )
}
