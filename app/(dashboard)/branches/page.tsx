import Topbar from '@/components/layout/Topbar'
import { MapPin, Users, Star, GitBranch, Gift } from 'lucide-react'
import { fmt } from '@/data/mock'
import { createClient } from '@/lib/supabase/server'

export default async function BranchesPage() {
  const supabase = await createClient()

  const [
    { data: branches },
    { data: customers },
    { data: pointsTxs },
  ] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, location, phone, color_hex')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('customers')
      .select('id, name, segment, home_branch_id, total_points')
      .eq('is_active', true),

    supabase
      .from('points_transactions')
      .select('branch_id, type, points'),
  ])

  const allBranches  = branches  ?? []
  const allCustomers = customers ?? []
  const allTxs       = pointsTxs ?? []

  // Derive accent colour from color_hex (lighten it for background)
  function hexAccent(hex: string): string {
    // Map known branch colors to accent backgrounds
    const accents: Record<string, string> = {
      '#c45f12': '#fdf6ee',
      '#0f766e': '#f0fdfa',
      '#7c3aed': '#f5f3ff',
    }
    return accents[hex] ?? '#f9fafb'
  }

  const branchData = allBranches.map(b => {
    const bCustomers  = allCustomers.filter(c => c.home_branch_id === b.id)
    const ptsEarned   = allTxs.filter(t => t.branch_id === b.id && t.type === 'earn').reduce((s, t) => s + t.points, 0)
    const ptsRedeemed = allTxs.filter(t => t.branch_id === b.id && t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0)
    const vipCount    = bCustomers.filter(c => c.segment === 'vip').length
    const topMember   = [...bCustomers].sort((a, b) => b.total_points - a.total_points)[0] ?? null
    return {
      ...b,
      accent:      hexAccent(b.color_hex),
      customers:   bCustomers,
      ptsEarned,
      ptsRedeemed,
      vipCount,
      topMember,
    }
  })

  const subtitle = `${allBranches.length} location${allBranches.length !== 1 ? 's' : ''} · ${allBranches.map(b => b.name).join(' · ')}`

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Branches" subtitle={subtitle} />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {branchData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <GitBranch size={36} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No branches found</p>
          </div>
        ) : (
          <>
            {/* Branch cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {branchData.map(b => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] transition-shadow"
                >
                  {/* Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div
                        className="mb-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold text-white"
                        style={{ background: b.color_hex }}
                      >
                        {b.name}
                      </div>
                      {b.location && (
                        <p className="flex items-center gap-1 text-[11px] text-gray-400">
                          <MapPin size={10} />{b.location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Users,  label: 'Members',  value: fmt(b.customers.length),           color: 'text-blue-700'   },
                      { icon: Star,   label: 'Earned',   value: fmt(b.ptsEarned) + ' pts',         color: 'text-amber-700'  },
                      { icon: Gift,   label: 'Redeemed', value: fmt(b.ptsRedeemed) + ' pts',       color: 'text-brand-700'  },
                      { icon: Users,  label: 'VIP',      value: fmt(b.vipCount) + ' members',      color: 'text-purple-700' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3" style={{ background: b.accent }}>
                        <s.icon size={13} className="text-gray-400 mb-1" />
                        <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Top member */}
                  {b.topMember ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-gray-200 p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[10px] font-bold text-white">
                        {b.topMember.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Top Member</p>
                        <p className="text-xs font-semibold text-gray-800">{b.topMember.name}</p>
                      </div>
                      <span className="ml-auto text-xs font-bold text-amber-700">
                        {fmt(b.topMember.total_points)} pts
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-100 p-3 text-center">
                      <p className="text-[10px] text-gray-300">No members yet</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Branch comparison */}
            <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <p className="mb-4 text-[13px] font-semibold text-gray-900">Branch Comparison</p>
              <div className="space-y-4">
                {(['customers', 'ptsEarned', 'ptsRedeemed'] as const).map(metric => {
                  const getValue = (b: typeof branchData[0]) =>
                    metric === 'customers'   ? b.customers.length :
                    metric === 'ptsRedeemed' ? b.ptsRedeemed : b.ptsEarned

                  const max = Math.max(...branchData.map(getValue), 1)
                  const labels: Record<typeof metric, string> = {
                    customers: 'Members', ptsEarned: 'Points Earned', ptsRedeemed: 'Points Redeemed',
                  }

                  return (
                    <div key={metric}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {labels[metric]}
                      </p>
                      <div className="space-y-2">
                        {branchData.map(b => {
                          const val  = getValue(b)
                          const pct  = (val / max) * 100
                          const display =
                            metric === 'customers' ? `${val} members` :
                            `${fmt(val)} pts`
                          return (
                            <div key={b.id} className="flex items-center gap-3">
                              <span className="w-20 truncate text-[11px] font-medium text-gray-600">
                                {b.name.split(' ')[0]}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: b.color_hex }}
                                />
                              </div>
                              <span className="w-24 text-right text-[11px] font-semibold text-gray-700">
                                {display}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  )
}
