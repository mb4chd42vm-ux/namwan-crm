'use client'

import { useState, useTransition } from 'react'
import { X, Pencil, CheckCircle, ChevronDown, Store } from 'lucide-react'
import { updateStaff } from '@/app/actions/staff'

interface Branch { id: string; name: string; color_hex: string }

type Role = 'admin' | 'manager' | 'staff'

const ROLE_LABELS: Record<Role, string> = {
  admin:   'Admin',
  manager: 'Manager',
  staff:   'Staff',
}

export default function EditStaffModal({
  staffId,
  currentName,
  currentRole,
  currentBranchId,
  branches,
}: {
  staffId:         string
  currentName:     string
  currentRole:     Role
  currentBranchId: string | null
  branches:        Branch[]
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name,     setName]     = useState(currentName)
  const [role,     setRole]     = useState<Role>(currentRole)
  const [branchId, setBranchId] = useState(currentBranchId ?? '')

  function reset() {
    setName(currentName); setRole(currentRole); setBranchId(currentBranchId ?? '')
    setError(null); setSuccess(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!name.trim()) { setError('Name is required'); return }

    const fd = new FormData()
    fd.append('staff_id',  staffId)
    fd.append('name',      name.trim())
    fd.append('role',      role)
    fd.append('branch_id', branchId)

    setError(null)
    startTransition(async () => {
      try {
        await updateStaff(fd)
        setSuccess(true)
        setTimeout(close, 1500)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
      >
        <Pencil size={10} /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Edit Staff Member</p>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {success ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle size={28} className="text-emerald-500" />
                  <p className="text-sm font-semibold text-gray-900">Updated!</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role *</label>
                    <div className="relative">
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <select
                        value={role}
                        onChange={e => setRole(e.target.value as Role)}
                        className="w-full h-10 px-3 pr-8 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white appearance-none focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      >
                        {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
                          <option key={r} value={r}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {branches.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Home Branch <span className="normal-case font-normal text-gray-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <Store size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                          value={branchId}
                          onChange={e => setBranchId(e.target.value)}
                          className="w-full h-10 pl-8 pr-8 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white appearance-none focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                        >
                          <option value="">All branches</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">{error}</p>
                  )}
                </>
              )}
            </div>

            {!success && (
              <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
                <button onClick={close} disabled={isPending} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={submit} disabled={isPending || !name.trim()} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
                  {isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
