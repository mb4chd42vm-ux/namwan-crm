import Topbar from '@/components/layout/Topbar'
import { getCurrentSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  User, Mail, ShieldCheck, Store, Users,
  Info, ExternalLink, Settings,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const ROLE_META = {
  admin:   { label: 'Admin',   color: 'text-brand-700',  bg: 'bg-brand-50 border border-brand-200'  },
  manager: { label: 'Manager', color: 'text-blue-700',   bg: 'bg-blue-50  border border-blue-200'   },
  staff:   { label: 'Staff',   color: 'text-gray-600',   bg: 'bg-gray-50  border border-gray-200'   },
}

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session || !session.profile) redirect('/login')

  const { email, profile } = session

  const supabase = await createClient()

  // Fetch branch name if user is assigned to a branch
  let branchName: string | null = null
  if (profile.branch_id) {
    const { data } = await supabase
      .from('branches')
      .select('name')
      .eq('id', profile.branch_id)
      .single()
    branchName = data?.name ?? null
  }

  // Fetch staff count for admin
  let staffCount: number | null = null
  if (profile.role === 'admin') {
    const { count } = await supabase
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    staffCount = count
  }

  const rm = ROLE_META[profile.role]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Settings" subtitle="Account & system configuration" />

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 max-w-2xl">

        {/* ── Profile card ── */}
        <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 mb-5">
            <Settings size={14} className="text-gray-400" />
            <p className="text-[13px] font-semibold text-gray-900">Your Profile</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-5">
            {/* Avatar */}
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white shadow-md">
              {profile.name.charAt(0).toUpperCase()}
            </div>

            {/* Details */}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* Name */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <User size={11} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Name</p>
                    <p className="text-xs font-semibold text-gray-900">{profile.name}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Mail size={11} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Email</p>
                    <p className="text-xs font-semibold text-gray-900 break-all">{email}</p>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <ShieldCheck size={11} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Role</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${rm.bg} ${rm.color}`}>
                      {rm.label}
                    </span>
                  </div>
                </div>

                {/* Branch */}
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <Store size={11} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">Branch</p>
                    <p className="text-xs font-semibold text-gray-900">
                      {branchName ?? 'All branches'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Role permissions note */}
          <div className="mt-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {profile.role === 'admin' && 'You have full access — manage staff, branches, and all member data.'}
              {profile.role === 'manager' && 'You can manage members, points, and view branch reports.'}
              {profile.role === 'staff' && 'You can scan QR codes, claim points, and process redemptions.'}
            </p>
          </div>
        </div>

        {/* ── Manage Staff (admin only) ── */}
        {profile.role === 'admin' && (
          <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3 mb-4">
              <Users size={14} className="text-gray-400" />
              <p className="text-[13px] font-semibold text-gray-900">Staff Management</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">
                  {staffCount !== null
                    ? `${staffCount} active staff member${staffCount !== 1 ? 's' : ''}`
                    : 'Manage your team'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Add, edit, or deactivate staff accounts and set their roles
                </p>
              </div>
              <a
                href="/settings/staff"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
              >
                <Users size={11} />
                Manage Staff
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: 'Add new staff',    desc: 'Create login accounts for team members' },
                { label: 'Set roles',        desc: 'Admin, Manager, or Staff permissions'   },
                { label: 'Branch assignment', desc: 'Assign staff to specific locations'    },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-gray-700">{item.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── System info ── */}
        <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 mb-4">
            <Info size={14} className="text-gray-400" />
            <p className="text-[13px] font-semibold text-gray-900">System</p>
          </div>

          <div className="space-y-2.5">
            {[
              { label: 'Application',  value: 'Namwan Loyalty' },
              { label: 'Version',      value: '1.0' },
              { label: 'Points rule',  value: '10 pts = 1 free drink' },
              { label: 'High Potential window', value: '7–9 pts (one visit away)' },
              { label: 'Inactive threshold',    value: '60 days no activity' },
              { label: 'New member window',     value: '14 days after joining' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-[11px] text-gray-500">{row.label}</span>
                <span className="text-[11px] font-semibold text-gray-800">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
