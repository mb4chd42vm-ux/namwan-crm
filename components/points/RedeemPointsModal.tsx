'use client'

import { useState, useTransition } from 'react'
import { X, Star, CheckCircle } from 'lucide-react'
import { redeemPoints } from '@/app/actions/redeemPoints'

const POINTS_PER_DRINK = 10

interface Branch { id: string; name: string; color_hex: string }

export default function RedeemPointsModal({
  customerId,
  customerName,
  currentBalance,
  branches,
  defaultBranchId,
}: {
  customerId:      string
  customerName:    string
  currentBalance:  number
  branches:        Branch[]
  defaultBranchId?: string | null
}) {
  const [open, setOpen]           = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error,   setError]       = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [branchId, setBranchId]   = useState(defaultBranchId ?? branches[0]?.id ?? '')

  const remainingAfter = currentBalance - POINTS_PER_DRINK
  const canRedeem      = currentBalance >= POINTS_PER_DRINK

  function reset() {
    setBranchId(defaultBranchId ?? branches[0]?.id ?? '')
    setError(null)
    setSuccess(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  function submit() {
    if (!branchId) { setError('Please select a branch'); return }

    const fd = new FormData()
    fd.append('customer_id', customerId)
    fd.append('branch_id',   branchId)

    setError(null)
    startTransition(async () => {
      try {
        await redeemPoints(fd)
        setSuccess(true)
        setTimeout(close, 2200)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!canRedeem}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Star size={11} className="fill-amber-400 text-amber-500" />
        Redeem Free Drink
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                  <Star size={14} className="text-amber-600 fill-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Redeem Free Drink</p>
                  <p className="text-[10px] text-gray-400">{customerName}</p>
                </div>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">

              {success ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                    <CheckCircle size={24} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">1 free drink redeemed!</p>
                    <p className="mt-1 text-xs text-gray-500">
                      <span className="font-bold text-red-500">−{POINTS_PER_DRINK}</span> pts ·{' '}
                      <span className="font-bold text-gray-700">{Math.max(0, remainingAfter)}</span> remaining
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Balance banner */}
                  <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Star size={13} className="fill-amber-400 text-amber-500" />
                        <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Balance</span>
                      </div>
                      <p className="text-[10px] text-amber-600 mt-0.5">10 pts = 1 free drink</p>
                    </div>
                    <span className="text-lg font-extrabold text-amber-700">{currentBalance.toLocaleString()}</span>
                  </div>

                  {/* What will be deducted */}
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Deducting</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-500">−{POINTS_PER_DRINK} pts</p>
                      <p className="text-[10px] text-gray-400">{Math.max(0, remainingAfter)} remaining</p>
                    </div>
                  </div>

                  {/* Branch selector */}
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
                  disabled={isPending || !branchId}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Redeeming…' : 'Redeem 1 Free Drink'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
