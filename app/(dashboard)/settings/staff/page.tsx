import { redirect } from 'next/navigation'
import { getCurrentSession, canManageStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Users, UserCog, ShieldCheck, Shield, User as UserIcon } from 'lucide-react'
import Topbar from '@/components/layout/Topbar'
import InviteStaffModal from '@/components/staff/InviteStaffModal'
import EditStaffModal from '@/components/staff/EditStaffModal'
import { toggleActive, deleteStaff } from '@/app/actions/staff'

type Role = 'admin' | 'manager' | 'staff'

const ROLE_BADGE: Record<Role, string> = {
  admin:   'bg-brand-100 text-brand-700',
  manager: 'bg-blue-50 text-blue-700',
  staff:   'bg-gray-100 text-gray-600',
}

const ROLE_ICON: Record<Role, React.ElementType> = {
  admin:   ShieldCheck,
  manager: Shield,
  staff:   UserIcon,
}

export default async function StaffPage() {
  const session = await getCurrentSession()
  if (!session || !session.profile || !canManageStaff(session.profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const [{ data: staffList }, { data: branches }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id, auth_user_id, name, email, role, branch_id, is_active, created_at, branches(name, color_hex)')
      .order('created_at', { ascending: true }),

    supabase
      .from('branches')
      .select('id, name, color_hex')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const staff    = staffList ?? []
  const allBranches = branches ?? []

  const activeCount   = staff.filter(s => s.is_active).length
  const adminCount    = staff.filter(s => s.role === 'admin').length
  const managerCount  = staff.filter(s => s.role === 'manager').length
  const staffCount    = staff.filter(s => s.role === 'staff').length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Staff Management"
        subtitle={`${staff.length} member${staff.length !== 1 ? 's' : ''} · ${activeCount} active`}
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Staff',  value: staff.length, color: 'text-gray-900',   bg: 'bg-gray-50' },
            { label: 'Admins',       value: adminCount,   color: 'text-brand-700',  bg: 'bg-brand-50' },
            { label: 'Managers',     value: managerCount, color: 'text-blue-700',   bg: 'bg-blue-50' },
            { label: 'Staff',        value: staffCount,   color: 'text-gray-600',   bg: 'bg-gray-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-white/80 ${s.bg} px-4 py-4 shadow-sm`}>
              <p className="text-[10px] text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-700">
            All Staff Members
          </p>
          <InviteStaffModal branches={allBranches} />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Users size={36} className="text-gray-200" />
              <p className="text-sm font-medium text-gray-400">No staff members yet</p>
              <p className="text-xs text-gray-300">Invite your first team member above</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Name', 'Email', 'Role', 'Branch', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(member => {
                  const role      = member.role as Role
                  const RoleIcon  = ROLE_ICON[role]
                  const branch    = member.branches as unknown as { name: string; color_hex: string } | null
                  const joinedStr = new Date(member.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })
                  const isSelf    = member.auth_user_id === session.userId

                  return (
                    <tr key={member.id} className={`hover:bg-gray-50/80 transition-colors ${!member.is_active ? 'opacity-50' : ''}`}>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{member.name}</p>
                            {isSelf && (
                              <p className="text-[9px] text-brand-500 font-semibold uppercase tracking-wide">You</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-gray-500">{member.email}</td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[role]}`}>
                          <RoleIcon size={9} />
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3">
                        {branch ? (
                          <span
                            className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ background: branch.color_hex }}
                          >
                            {branch.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="text-gray-400">All</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          member.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {member.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 text-gray-400">{joinedStr}</td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <EditStaffModal
                            staffId={member.id}
                            currentName={member.name}
                            currentRole={role}
                            currentBranchId={member.branch_id}
                            branches={allBranches}
                          />

                          {/* Toggle active — not available on self */}
                          {!isSelf && (
                            <form action={toggleActive}>
                              <input type="hidden" name="staff_id"  value={member.id} />
                              <input type="hidden" name="is_active" value={String(member.is_active)} />
                              <button
                                type="submit"
                                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  member.is_active
                                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {member.is_active ? 'Suspend' : 'Reactivate'}
                              </button>
                            </form>
                          )}

                          {/* Delete — not available on self */}
                          {!isSelf && (
                            <form action={deleteStaff}>
                              <input type="hidden" name="staff_id" value={member.id} />
                              <button
                                type="submit"
                                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                onClick={e => {
                                  if (!confirm(`Remove ${member.name}? This cannot be undone.`)) {
                                    e.preventDefault()
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Permissions reference */}
        <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <p className="mb-4 text-[13px] font-semibold text-gray-900">Role Permissions</p>
          <div className="grid grid-cols-3 gap-4">
            {([
              {
                role: 'Admin',
                color: '#c45f12',
                accent: '#fdf6ee',
                perms: ['Dashboard & analytics', 'Customer management', 'Purchase logging', 'Point redemption', 'QR code generation', 'Manual point adjustment', 'Campaign management', 'Branch management', 'Staff management'],
                denied: [] as string[],
              },
              {
                role: 'Manager',
                color: '#0f766e',
                accent: '#f0fdfa',
                perms: ['Dashboard & analytics', 'Customer management', 'Purchase logging', 'Point redemption', 'QR code generation', 'Manual point adjustment', 'Campaign management', 'Branch management'],
                denied: ['Staff management'] as string[],
              },
              {
                role: 'Staff',
                color: '#6b7280',
                accent: '#f9fafb',
                perms: ['Customer management', 'Purchase logging', 'Point redemption', 'QR code generation'],
                denied: ['Dashboard (limited)', 'Manual point adjustment', 'Campaign management', 'Branch management', 'Staff management'] as string[],
              },
            ]).map(({ role, color, accent, perms, denied }) => (
              <div key={role} className="rounded-xl p-4" style={{ background: accent }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  <p className="text-xs font-bold text-gray-800">{role}</p>
                </div>
                <ul className="space-y-1">
                  {perms.map(p => (
                    <li key={p} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <span className="text-emerald-500 font-bold">✓</span> {p}
                    </li>
                  ))}
                  {denied?.map(p => (
                    <li key={p} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <span className="font-bold">✗</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
