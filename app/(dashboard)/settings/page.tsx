import Topbar from '@/components/layout/Topbar'
import { getCurrentSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  User, Mail, ShieldCheck, Store, Users,
  Info, ExternalLink, AlertTriangle, ArrowLeft, Wheat,
} from 'lucide-react'
import type { Role } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ROLE_META: Record<Role, { label: string; color: string; bg: string }> = {
  admin:   { label: 'Administrator', color: 'text-brand-700',  bg: 'bg-brand-50 border border-brand-200'  },
  manager: { label: 'Manager',       color: 'text-cocoa-700',  bg: 'bg-sand-100 border border-sand-200'   },
  staff:   { label: 'Staff',         color: 'text-cocoa-600',  bg: 'bg-cream-200 border border-cream-300' },
}

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const { email, profile } = session

  const displayName    = profile?.name  ?? email.split('@')[0]
  const displayRole    = (profile?.role ?? 'staff') as Role
  const profileMissing = !profile

  const supabase = await createClient()

  let branchName: string | null = null
  if (profile?.branch_id) {
    const { data } = await supabase
      .from('branches')
      .select('name')
      .eq('id', profile.branch_id)
      .single()
    branchName = data?.name ?? null
  }

  let staffCount: number | null = null
  if (displayRole === 'admin') {
    const { count } = await supabase
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    staffCount = count
  }

  const rm = ROLE_META[displayRole]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Settings" subtitle="Account & preferences" />

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5 max-w-xl">

        {/* Back link */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-cocoa-500 hover:text-cocoa-800 transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Dashboard
        </a>

        {/* Profile load warning */}
        {profileMissing && (
          <div className="flex items-start gap-3 rounded-2xl border border-sand-200 bg-sand-100 px-4 py-4">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-cocoa-500" />
            <p className="text-[13px] text-cocoa-700 leading-relaxed">
              Your staff profile could not be loaded. Role and branch shown may not be accurate.
              Contact an admin to verify your account setup.
            </p>
          </div>
        )}

        {/* ── Profile card ── */}
        <div className="rounded-3xl bg-white border border-cream-200 shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-5 border-b border-cream-200 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
              <User size={15} className="text-brand-600" />
            </div>
            <p className="text-[14px] font-bold text-cocoa-900">Your Profile</p>
          </div>

          <div className="px-6 py-6">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Avatar */}
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold text-white shadow-md shadow-brand-900/20">
                {displayName.charAt(0).toUpperCase()}
              </div>

              {/* Details grid */}
              <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cream-100 border border-cream-200">
                    <User size={12} className="text-cocoa-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cocoa-400 uppercase tracking-widest mb-0.5">Name</p>
                    <p className="text-[13px] font-semibold text-cocoa-900">{displayName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cream-100 border border-cream-200">
                    <Mail size={12} className="text-cocoa-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cocoa-400 uppercase tracking-widest mb-0.5">Email</p>
                    <p className="text-[13px] font-semibold text-cocoa-900 break-all">{email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 border border-brand-100">
                    <ShieldCheck size={12} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cocoa-400 uppercase tracking-widest mb-1">Role</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rm.bg} ${rm.color}`}>
                      {rm.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cream-100 border border-cream-200">
                    <Store size={12} className="text-cocoa-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cocoa-400 uppercase tracking-widest mb-0.5">Branch</p>
                    <p className="text-[13px] font-semibold text-cocoa-900">
                      {branchName ?? 'All branches'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions note */}
            <div className="mt-5 rounded-xl bg-cream-50 border border-cream-200 px-4 py-3">
              <p className="text-[12px] text-cocoa-500 leading-relaxed">
                {displayRole === 'admin'   && 'You have full access — manage staff, branches, members, and all data.'}
                {displayRole === 'manager' && 'You can manage members, adjust points, and view branch reports.'}
                {displayRole === 'staff'   && 'You can scan QR codes, claim points, and process redemptions.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Staff Management (admin only) ── */}
        {displayRole === 'admin' && (
          <div className="rounded-3xl bg-white border border-cream-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-cream-200 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                <Users size={15} className="text-brand-600" />
              </div>
              <p className="text-[14px] font-bold text-cocoa-900">Staff Management</p>
            </div>

            <div className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-cocoa-700">
                    {staffCount !== null
                      ? `${staffCount} active staff member${staffCount !== 1 ? 's' : ''}`
                      : 'Manage your team'}
                  </p>
                  <p className="text-[12px] text-cocoa-400 mt-0.5">
                    Add, edit, or deactivate accounts and set roles
                  </p>
                </div>
                <a
                  href="/settings/staff"
                  className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-800 transition-colors shadow-md shadow-brand-900/20"
                >
                  <Users size={12} />
                  Manage
                  <ExternalLink size={10} />
                </a>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Add new staff',     desc: 'Create login accounts' },
                  { label: 'Set roles',          desc: 'Admin, Manager, Staff' },
                  { label: 'Branch assignment',  desc: 'Assign to locations'   },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-cream-50 border border-cream-200 px-4 py-3">
                    <p className="text-[12px] font-semibold text-cocoa-800">{item.label}</p>
                    <p className="text-[11px] text-cocoa-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── System info ── */}
        <div className="rounded-3xl bg-white border border-cream-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-cream-200 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-100 border border-cream-200">
              <Wheat size={15} className="text-cocoa-500" />
            </div>
            <p className="text-[14px] font-bold text-cocoa-900">System</p>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-0">
              {[
                { label: 'Application',           value: 'Namwan Loyalty' },
                { label: 'Version',               value: '1.0' },
                { label: 'Points rule',           value: '10 pts = 1 free drink' },
                { label: 'High Potential window', value: '7–9 pts (one visit away)' },
                { label: 'Inactive threshold',    value: '60 days no activity' },
                { label: 'New member window',     value: '14 days after joining' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-3.5 border-b border-cream-100 last:border-0">
                  <span className="text-[12px] text-cocoa-500">{row.label}</span>
                  <span className="text-[12px] font-semibold text-cocoa-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-cocoa-300 pb-4">
          © 2025 Namwan · Loyalty Platform
        </p>

      </main>
    </div>
  )
}
