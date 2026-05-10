'use client'

import { useState, useTransition } from 'react'
import { X, UserPlus, CheckCircle } from 'lucide-react'
import { addCustomer } from '@/app/actions/customers'

export default function AddCustomerModal() {
  const [open, setOpen]       = useState(false)
  const [isPending, start]    = useTransition()
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [lineId,   setLineId]   = useState('')
  const [birthday, setBirthday] = useState('')
  const [notes,    setNotes]    = useState('')

  function reset() {
    setName(''); setPhone(''); setLineId(''); setBirthday(''); setNotes('')
    setError(null); setSuccess(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!name.trim())  { setError('Name is required');  return }
    if (!phone.trim()) { setError('Phone is required'); return }

    const fd = new FormData()
    fd.append('name',     name)
    fd.append('phone',    phone)
    fd.append('line_id',  lineId)
    fd.append('birthday', birthday)
    fd.append('notes',    notes)

    setError(null)
    start(async () => {
      try {
        await addCustomer(fd)
        setSuccess(true)
        setTimeout(close, 1600)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        <UserPlus size={13} /> Add Customer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100">
                  <UserPlus size={14} className="text-brand-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900">Add Customer</h2>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {success ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Customer added!</p>
                    <p className="mt-0.5 text-xs text-gray-400">{name} has been added to the loyalty programme.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Full name"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="e.g. 0812345678"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                    />
                  </div>

                  {/* LINE ID + Birthday side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        LINE User ID
                      </label>
                      <input
                        type="text"
                        value={lineId}
                        onChange={e => setLineId(e.target.value)}
                        placeholder="U1234…"
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Birthday
                      </label>
                      <input
                        type="date"
                        value={birthday}
                        onChange={e => setBirthday(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Notes <span className="normal-case text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Allergies, preferences, VIP notes…"
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors resize-none"
                    />
                  </div>

                  {error && (
                    <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
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
                  disabled={isPending || !name.trim() || !phone.trim()}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving…' : 'Add Customer'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
