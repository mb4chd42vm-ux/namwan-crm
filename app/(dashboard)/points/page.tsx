import Topbar from '@/components/layout/Topbar'
import { Star, QrCode } from 'lucide-react'
import Link from 'next/link'
import { TX_META, pts, fmt, type TxType } from '@/data/mock'
import { createClient } from '@/lib/supabase/server'

export default async function PointsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params       = await searchParams
  const branchFilter = params.branch ?? null

  const supabase = await createClient()

  const [{ data: branches }, { data: customers }, { data: txs }] = await Promise.all([

    supabase
      .from('branches')
      .select('id, name, color_hex')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('customers')
      .select('total_points'),

    supabase
      .from('points_transactions')
      .select(`
        id, type, points, balance_after, note, created_at,
        customers ( name ),
        branches  ( id, name, color_hex )
      `)
      .order('created_at', { ascending: false }),
  ])

  const allTxs      = txs ?? []
  const allCustomers = customers ?? []

  // Apply branch filter to tx list
  const filtered = branchFilter
    ? allTxs.filter(t => {
        const b = t.branches as unknown as { id: string } | null
        return b?.id === branchFilter
      })
    : allTxs

  // Stats from unfiltered (global balance)
  const totalEarned   = allTxs.filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0)
  const totalRedeemed = allTxs.filter(t => t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0)
  const totalExpired  = allTxs.filter(t => t.type === 'expire').reduce((s, t) => s + Math.abs(t.points), 0)
  const outstanding   = allCustomers.reduce((s, c) => s + c.total_points, 0)

  // Accent colour map
  const accentMap: Record<string, string> = {
    '#c45f12': '#fdf6ee',
    '#0f766e': '#f0fdfa',
    '#7c3aed': '#f5f3ff',
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Points Management"
        subtitle="1 drink = 1 point · 10 points = 1 free drink"
        branches={branches ?? []}
        activeBranch={branchFilter}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Earned',   value: pts(totalEarned),   color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Total Redeemed', value: pts(totalRedeemed), color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'Total Expired',  value: pts(totalExpired),  color: 'text-red-500',     bg: 'bg-red-50'     },
            { label: 'Outstanding',    value: pts(outstanding),   color: 'text-amber-700',   bg: 'bg-amber-50'   },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/80 ${s.bg} px-4 py-4 shadow-sm`}>
              <p className="text-[10px] text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-700">Transaction Log</p>
          <Link
            href="/points/qr/create"
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            <QrCode size={13} /> Generate QR
          </Link>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Date', 'Customer', 'Branch', 'Type', 'Points', 'Balance After', 'Note'].map(h => (
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
                      <Star size={28} className="text-gray-200" />
                      <p className="text-xs font-medium text-gray-400">No transactions found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(tx => {
                  const cust   = tx.customers as unknown as { name: string } | null
                  const branch = tx.branches  as unknown as { name: string; color_hex: string } | null
                  const m      = TX_META[tx.type as TxType]
                  const dateStr = new Date(tx.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{dateStr}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                            {cust?.name.charAt(0) ?? '?'}
                          </div>
                          <span className="font-medium text-gray-800">{cust?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {branch ? (
                          <span
                            className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ background: branch.color_hex }}
                          >
                            {branch.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize ${m.bg} ${m.color}`}>
                          {m.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${tx.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {fmt(tx.balance_after)} pts
                      </td>
                      <td className="px-4 py-3 text-gray-400 italic">{tx.note ?? '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Per-branch breakdown */}
        {(branches ?? []).length > 0 && (
          <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="mb-4 text-[13px] font-semibold text-gray-900">Points by Branch</p>
            <div className="grid grid-cols-3 gap-4">
              {(branches ?? []).map(b => {
                const bTxs    = allTxs.filter(t => {
                  const br = t.branches as unknown as { id: string } | null
                  return br?.id === b.id
                })
                const earned   = bTxs.filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0)
                const redeemed = bTxs.filter(t => t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0)
                const accent   = accentMap[b.color_hex] ?? '#f9fafb'
                return (
                  <div key={b.id} className="rounded-xl p-4" style={{ background: accent }}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color_hex }} />
                      <p className="text-xs font-semibold text-gray-800">{b.name}</p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Earned</span>
                        <span className="font-semibold text-emerald-700">+{fmt(earned)} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Redeemed</span>
                        <span className="font-semibold text-blue-700">-{fmt(redeemed)} pts</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
