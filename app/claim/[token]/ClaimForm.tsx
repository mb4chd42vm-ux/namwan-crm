'use client'

import { useState, useTransition, useEffect } from 'react'
import { Star, CheckCircle, AlertTriangle, Phone, Loader2 } from 'lucide-react'
import { claimQRToken } from '@/app/actions/qrClaims'
import { useLiff } from '@/hooks/useLiff'

interface Customer { id: string; name: string; phone: string }

// Resolved customer for claiming (either from LINE or phone lookup)
interface ResolvedCustomer { id: string; name: string; via: 'line' | 'phone' }

export default function ClaimForm({
  token,
  drinkQuantity,
  points,
  branchName,
  branchColor,
  customers,
}: {
  token:          string
  drinkQuantity:  number
  points:         number
  branchName:     string
  branchColor:    string
  customers:      Customer[]
}) {
  const [isPending, startTransition] = useTransition()
  const [phone,   setPhone]          = useState('')
  const [error,   setError]          = useState<string | null>(null)
  const [claimed, setClaimed]        = useState<{ points: number; drinkQuantity: number } | null>(null)

  // LINE identification (optional — forceLogin=false so we don't redirect)
  const liff = useLiff(false)
  const [lineCustomer,     setLineCustomer]     = useState<ResolvedCustomer | null>(null)
  const [lineCheckDone,    setLineCheckDone]    = useState(false)
  const [lineNotFound,     setLineNotFound]     = useState(false)

  // When LIFF is ready, look up the customer by line_id server-side
  useEffect(() => {
    if (liff.status === 'unavailable' || liff.status === 'not_logged_in') {
      setLineCheckDone(true)
      return
    }
    if (liff.status === 'error') {
      setLineCheckDone(true)
      return
    }
    if (liff.status !== 'ready') return

    // LIFF ready → resolve customer by line_id
    ;(async () => {
      try {
        const res  = await fetch('/api/liff/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line_id: liff.profile.userId }),
        })
        const data = await res.json()

        if (data.found && data.customer) {
          setLineCustomer({ id: data.customer.id, name: data.customer.name, via: 'line' })
        } else {
          setLineNotFound(true)
        }
      } catch {
        // Ignore — fall back to phone
      } finally {
        setLineCheckDone(true)
      }
    })()
  }, [liff.status])

  // Phone-based match (shown when LINE not available or customer not found)
  const phoneMatched: ResolvedCustomer | null =
    phone.trim().length >= 3
      ? (() => {
          const c = customers.find(c => c.phone.includes(phone.trim()))
          return c ? { id: c.id, name: c.name, via: 'phone' } : null
        })()
      : null

  // Which customer will receive the points
  const resolved: ResolvedCustomer | null = lineCustomer ?? phoneMatched

  // Are we still waiting for the LIFF check?
  const liffPending = !lineCheckDone && liff.status === 'loading'

  function submit() {
    if (!resolved) { setError('Please enter your phone number and try again.'); return }

    const fd = new FormData()
    fd.append('token',       token)
    fd.append('customer_id', resolved.id)

    setError(null)
    startTransition(async () => {
      try {
        const res = await claimQRToken(fd)
        setClaimed(res)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (claimed) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle size={48} className="text-emerald-500" />
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-gray-900">Points Claimed!</p>
          <p className="text-lg font-semibold text-emerald-600">
            +{claimed.points} point{claimed.points !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-gray-500">
            {claimed.drinkQuantity} drink{claimed.drinkQuantity !== 1 ? 's' : ''} · {branchName}
          </p>
        </div>
        <p className="text-sm text-gray-400">You can close this page now.</p>
      </div>
    )
  }

  // ── LIFF loading ─────────────────────────────────────────────────────────
  if (liffPending) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 size={28} className="text-gray-300 animate-spin" />
        <p className="text-sm text-gray-400">Checking your LINE account…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Reward preview */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-5 text-white"
        style={{ background: branchColor }}
      >
        <div>
          <p className="text-sm font-semibold opacity-80">Points to claim</p>
          <p className="text-4xl font-black mt-1">+{points}</p>
          <p className="text-sm opacity-70 mt-1.5">
            {drinkQuantity} drink{drinkQuantity !== 1 ? 's' : ''} · {branchName}
          </p>
        </div>
        <Star size={52} className="opacity-25 fill-white" />
      </div>

      {/* ── LINE auto-detected ─────────────────────────────────────────────── */}
      {lineCustomer && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-[#06C755]/10 border border-[#06C755]/30 px-4 py-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#06C755]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                <path d="M12 2C6.48 2 2 6.16 2 11.25c0 4.58 3.87 8.4 9.08 9.12.35.07.84.23.96.52.11.26.07.67.03.94l-.15.91c-.05.26-.22 1.03.9.56 1.12-.47 6.05-3.56 8.25-6.1C22.66 15.01 22 13.2 22 11.25 22 6.16 17.52 2 12 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{lineCustomer.name}</p>
              <p className="text-xs text-green-700">Identified via LINE</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="w-full rounded-2xl h-14 text-base font-bold text-white transition-colors disabled:opacity-40"
            style={{ background: branchColor }}
          >
            {isPending ? 'Claiming…' : `Claim ${points} Point${points !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* ── Phone fallback ─────────────────────────────────────────────────── */}
      {!lineCustomer && (
        <div className="space-y-4">
          {/* Show note if LINE was found but customer not linked */}
          {lineNotFound && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Your LINE account isn't linked yet. Enter your phone number below to claim.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your phone number
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(null) }}
                placeholder="0812345678"
                autoFocus={!lineNotFound}
                className="w-full h-14 pl-11 pr-4 rounded-xl border border-gray-200 text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors"
              />
            </div>

            {/* Phone match preview */}
            {phoneMatched && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-bold text-emerald-800">
                  {phoneMatched.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">{phoneMatched.name}</p>
                  <p className="text-xs text-emerald-600">Found by phone number</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending || !phoneMatched}
            className="w-full rounded-2xl h-14 text-base font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: phoneMatched ? branchColor : undefined, backgroundColor: phoneMatched ? undefined : '#d1d5db' }}
          >
            {isPending ? 'Claiming…' : `Claim ${points} Point${points !== 1 ? 's' : ''}`}
          </button>

          <p className="text-center text-sm text-gray-400">
            Not registered? Ask staff to sign you up.
          </p>
        </div>
      )}
    </div>
  )
}
