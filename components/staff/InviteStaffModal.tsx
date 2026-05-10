'use client'

import { useState, useTransition } from 'react'
import { X, UserPlus, Mail, Lock, User, ChevronDown, CheckCircle, Store } from 'lucide-react'
import { createStaff } from '@/app/actions/staff'

interface Branch { id: string; name: string; color_hex: string }

const ROLE_INFO = {
  admin:   { label: 'Admin',   desc: 'Full access to all features',               color: 'text-brand-700 bg-brand-50 border-brand-200' },
  manager: { label: 'Manager', desc: 'All features except staff management',       color: 'text-blue-700 bg-blue-50 border-blue-200' },
  staff:   { label: 'Staff',   desc: 'Purchases, QR codes, and point redemption',  color: 'text-gray-700 bg-gray-50 border-gray-200' },
} as const

type Role = keyof typeof ROLE_INFO

export default function InviteStaffModal({ branches }: { branches: Branch[] }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<Role>('staff')
  const [branchId, setBranchId] = useState('')
  const [showPass, setShowPass] = useState(false)

  function reset() {
    setName(''); setEmail(''); setPassword(''); setRole('staff'); setBranchId('')
    setError(null); setSuccess(false); setShowPass(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!name.trim())  { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    const fd = new FormData()
    fd.append('name',      name.trim())
    fd.append('email',     email.trim())
    fd.append('password',  password)
    fd.append('role',      role)
    fd.append('branch_id', branchId)

    setError(null)
    startTransition(async () => {
      try {
        await createStaff(fd)
        setSuccess(true)
        setTimeout(close, 2000)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
      >
        <UserPlus size={13} /> Invite Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100">
                  <UserPlus size={14} className="text-brand-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Invite Staff Member</h2>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* body */}
            <div className="px-6 py-5 space-y-4">

              {success ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Staff member invited!</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {name} can now sign in with their credentials.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Somchai Jaidee"
                        autoFocus
                        className="w-full h-10 pl-8 pr-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                  </div>

                  {/* email */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="staff@namwan.com"
                        className="w-full h-10 pl-8 pr-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                  </div>

                  {/* password */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Temporary Password *
                    </label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full h-10 pl-8 pr-16 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400 hover:text-gray-700"
                      >
                        {showPass ? 'hide' : 'show'}
                      </button>
                    </div>
                  </div>

                  {/* role */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Role *
                    </label>
                    <div className="space-y-2">
                      {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([r, info]) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            role === r
                              ? info.color + ' border'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 ${
                            role === r ? 'border-current bg-current' : 'border-gray-300'
                          }`} />
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold ${role === r ? '' : 'text-gray-700'}`}>
                              {info.label}
                            </p>
                            <p className={`text-[10px] ${role === r ? 'opacity-70' : 'text-gray-400'}`}>
                              {info.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* branch (optional) */}
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
                    <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* footer */}
            {!success && (
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={close}
                  disabled={isPending}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isPending || !name || !email || password.length < 8}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
