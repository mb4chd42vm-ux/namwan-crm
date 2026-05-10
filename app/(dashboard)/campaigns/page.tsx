import Topbar from '@/components/layout/Topbar'
import { Plus, Calendar, Users, Zap, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSession, canManageCampaigns } from '@/lib/auth'
import { redirect } from 'next/navigation'

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  draft:  'bg-amber-50  text-amber-700  border border-amber-200',
  ended:  'bg-gray-50   text-gray-500   border border-gray-200',
}

const SEG_STYLE: Record<string, string> = {
  all:       'bg-gray-100   text-gray-600',
  vip:       'bg-amber-100  text-amber-700',
  inactive:  'bg-red-100    text-red-700',
  new:       'bg-blue-100   text-blue-700',
  returning: 'bg-green-100  text-green-700',
}

const CAMPAIGN_COLORS: Record<string, string> = {
  all:       '#d97519',
  vip:       '#7c3aed',
  inactive:  '#0f766e',
  new:       '#2563eb',
  returning: '#0f766e',
}

export default async function CampaignsPage() {
  const session = await getCurrentSession()
  if (!session || !canManageCampaigns(session.profile?.role ?? 'staff')) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const [{ data: branches }, { data: campaigns }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, color_hex')
      .eq('is_active', true)
      .order('sort_order'),

    supabase
      .from('campaigns')
      .select(`
        id, name, description, target_segment, status, starts_at, ends_at,
        branches ( name, color_hex )
      `)
      .order('created_at', { ascending: false }),
  ])

  const allCampaigns = campaigns ?? []
  const active = allCampaigns.filter(c => c.status === 'active').length
  const draft  = allCampaigns.filter(c => c.status === 'draft').length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Campaigns"
        subtitle="Loyalty promotions and re-engagement programs"
        branches={branches ?? []}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active Campaigns', value: active,             icon: Zap,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Draft',            value: draft,              icon: Calendar,  color: 'text-amber-600',   bg: 'bg-amber-50'   },
            { label: 'Total',            value: allCampaigns.length, icon: Users,    color: 'text-brand-600',   bg: 'bg-brand-50'   },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white border border-gray-100 px-4 py-3 shadow-sm flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-700">All Campaigns</p>
          <button className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-colors">
            <Plus size={13} /> New Campaign
          </button>
        </div>

        {/* Empty state */}
        {allCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Megaphone size={36} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-400">No campaigns yet</p>
            <p className="text-xs text-gray-300">Create your first loyalty campaign to engage customers</p>
          </div>
        ) : (
          /* Cards grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {allCampaigns.map(c => {
              const branch = c.branches as unknown as { name: string; color_hex: string } | null
              const accentColor = branch?.color_hex ?? CAMPAIGN_COLORS[c.target_segment] ?? '#d97519'
              const segLabel = c.target_segment === 'all'
                ? 'All Customers'
                : c.target_segment.charAt(0).toUpperCase() + c.target_segment.slice(1)

              return (
                <div
                  key={c.id}
                  className="group rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all cursor-pointer"
                >
                  {/* Top accent bar */}
                  <div className="mb-4 h-1 w-12 rounded-full" style={{ background: accentColor }} />

                  {/* Badges */}
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${SEG_STYLE[c.target_segment]}`}>
                      {segLabel}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 mb-1">{c.name}</h3>
                  {c.description && (
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">{c.description}</p>
                  )}

                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <Calendar size={10} />
                      <span>
                        {new Date(c.starts_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        {c.ends_at
                          ? ` — ${new Date(c.ends_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                          : ' · No end date'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />
                      {branch?.name ?? 'All Branches'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </main>
    </div>
  )
}
