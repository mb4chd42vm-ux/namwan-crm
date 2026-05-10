'use client'

import { useState, useTransition } from 'react'
import { X, ShoppingBag, Star, Coffee, Plus, CheckCircle } from 'lucide-react'
import { addPurchase } from '@/app/actions/purchases'

interface Branch { id: string; name: string; color_hex: string }

export default function CustomerPurchaseModal({
  customerId,
  customerName,
  branches,
  defaultBranchId,
}: {
  customerId: string
  customerName: string
  branches: Branch[]
  defaultBranchId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? '')
  const [amount,   setAmount]   = useState('')
  const [drinks,   setDrinks]   = useState('')
  const [note,     setNote]     = useState('')

  const drinkCount = Math.max(0, Math.floor(Number(drinks) || 0))
  const pointsEarned = drinkCount  // 1 drink = 1 point

  function reset() {
    setBranchId(defaultBranchId ?? branches[0]?.id ?? '')
    setAmount('')
    setDrinks('')
    setNote('')
    setError(null)
    setSuccess(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!branchId) { setError('Please select a branch'); return }
    if (!amount || Number(amount) <= 0) { setError('Please enter a valid amount'); return }
    if (drinkCount < 0) { setError('Drink quantity cannot be negative'); return }

    const fd = new FormData()
    fd.append('customer_id',    customerId)
    fd.append('branch_id',      branchId)
    fd.append('total_amount',   amount)
    fd.append('drink_quantity', String(drinkCount))
    fd.append('staff_note',     note)

    setError(null)
    startTransition(async () => {
      try {
        await addPurchase(fd)
        setSuccess(true)
        setTimeout(close, 1800)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
      >
        <Plus size={12} /> Add Purchase
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">

            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100">
                  <ShoppingBag size={14} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Add Purchase</p>
                  <p className="text-[10px] text-gray-400">{customerName}</p>
                </div>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* body */}
            <div className="px-5 py-5 space-y-4">

              {success ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Purchase saved!</p>
                    {pointsEarned > 0 && (
                      <p className="mt-1 text-xs text-emerald-600 flex items-center justify-center gap-1">
                        <Star size={10} className="fill-emerald-400 text-emerald-500" />
                        +{pointsEarned} point{pointsEarned !== 1 ? 's' : ''} earned ({drinkCount} drink{drinkCount !== 1 ? 's' : ''})
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* branch */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Branch *
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {branches.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBranchId(b.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition-all ${
                            branchId === b.id
                              ? 'border-transparent text-white shadow-sm'
                              : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                          }`}
                          style={branchId === b.id ? { background: b.color_hex } : {}}
                        >
                          <span
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ background: branchId === b.id ? 'rgba(255,255,255,0.6)' : b.color_hex }}
                          />
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* drink quantity — primary points field */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Drinks Ordered *
                      <span className="ml-1.5 normal-case font-normal text-gray-400">1 drink = 1 point</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none">
                        <Coffee size={13} className="text-gray-400" />
                      </span>
                      <input
                        type="number"
                        value={drinks}
                        onChange={e => setDrinks(e.target.value)}
                        placeholder="0"
                        min="0"
                        step="1"
                        autoFocus
                        className="w-full h-11 pl-8 pr-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                    <div className={`mt-2 h-6 transition-opacity ${drinkCount > 0 ? 'opacity-100' : 'opacity-0'}`}>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <Star size={9} className="fill-emerald-400 text-emerald-500" />
                        +{pointsEarned} point{pointsEarned !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* amount — for revenue tracking */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Total Amount (THB) *
                      <span className="ml-1.5 normal-case font-normal text-gray-400">for sales reporting</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium select-none">฿</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0"
                        min="1"
                        step="1"
                        className="w-full h-11 pl-7 pr-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
                      />
                    </div>
                  </div>

                  {/* note */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Staff Note <span className="normal-case text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="e.g. Birthday cake, custom order…"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
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

            {/* footer */}
            {!success && (
              <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
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
                  disabled={isPending || !branchId || !amount || Number(amount) <= 0}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Saving…' : 'Save Purchase'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
