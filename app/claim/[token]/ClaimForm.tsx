'use client'

import { useState, useTransition, useEffect } from 'react'
import { Star, CheckCircle, AlertTriangle, Phone, Loader2 } from 'lucide-react'
import { claimQRToken } from '@/app/actions/qrClaims'
import { useLiff } from '@/hooks/useLiff'

interface Customer { id: string; name: string; phone: string }
interface ResolvedCustomer { id: string; name: string; via: 'line' | 'phone' }

export default function ClaimForm({
  token,
  drinkQuantity,
  points,
  branchName,
  branchColor,
  customers,
}: {
  token:         string
  drinkQuantity: number
  points:        number
  branchName:    string
  branchColor:   string
  customers:     Customer[]
}) {
  const [isPending, startTransition] = useTransition()
  const [phone,     setPhone]        = useState('')
  const [error,     setError]        = useState<string | null>(null)
  const [claimed,   setClaimed]      = useState<{ points: number; drinkQuantity: number; newBalance: number | null } | null>(null)

  const liff = useLiff()
  const [lineCustomer,  setLineCustomer]  = useState<ResolvedCustomer | null>(null)
  const [lineCheckDone, setLineCheckDone] = useState(false)
  const [lineNotFound,  setLineNotFound]  = useState(false)

  useEffect(() => {
    if (liff.status === 'unavailable' || liff.status === 'not_logged_in' || liff.status === 'error') {
      setLineCheckDone(true)
      return
    }
    if (liff.status !== 'ready' || !liff.profile) return

    ;(async () => {
      try {
        const res  = await fetch('/api/liff/me', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ line_id: liff.profile!.userId }),
        })
        const data = await res.json()
        if (data.found && data.customer) {
          setLineCustomer({ id: data.customer.id, name: data.customer.name, via: 'line' })
        } else {
          setLineNotFound(true)
        }
      } catch {
        // silent — fall back to phone
      } finally {
        setLineCheckDone(true)
      }
    })()
  }, [liff.status, liff.profile])

  const phoneMatched: ResolvedCustomer | null =
    phone.trim().length >= 3
      ? (() => {
          const c = customers.find(c => c.phone.includes(phone.trim()))
          return c ? { id: c.id, name: c.name, via: 'phone' } : null
        })()
      : null

  const resolved: ResolvedCustomer | null = lineCustomer ?? phoneMatched
  const liffPending = !lineCheckDone && liff.status === 'loading'

  function submit() {
    if (!resolved) { setError('Please enter your phone number.'); return }
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

  // ── Success ───────────────────────────────────────────────────────────────────
  if (claimed) {
    return (
      <div className="flex flex-col items-center gap-7 py-6 text-center">
        {/* Icon */}
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: `${branchColor}22` }}
        >
          <CheckCircle size={52} style={{ color: branchColor }} />
        </div>

        {/* Points earned */}
        <div className="space-y-1.5">
          <p className="text-3xl font-black text-gray-900">
            +{claimed.points} point{claimed.points !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-gray-500">
            {claimed.drinkQuantity} drink{claimed.drinkQuantity !== 1 ? 's' : ''} at {branchName}
          </p>
        </div>

        {/* Balance */}
        {claimed.newBalance !== null && (
          <div
            className="w-full rounded-2xl px-5 py-4 text-center"
            style={{ background: `${branchColor}15` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: branchColor }}>
              Points Balance
            </p>
            <p className="text-4xl font-black mt-1" style={{ color: branchColor }}>
              {claimed.newBalance.toLocaleString()}
            </p>
            <p className="text-xs mt-1" style={{ color: branchColor, opacity: 0.7 }}>
              10 points = 1 free drink
            </p>
          </div>
        )}

        {/* Done */}
        <button
          type="button"
          onClick={() => window.close?.()}
          className="w-full h-14 rounded-2xl text-base font-bold text-white"
          style={{ background: branchColor }}
        >
          Done
        </button>
      </div>
    )
  }

  // ── LIFF loading ──────────────────────────────────────────────────────────────
  if (liffPending) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 size={28} className="text-gray-300 animate-spin" />
        <p className="text-sm text-gray-400">Setting up…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Reward banner */}
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

      {/* ── LINE identified ─────────────────────────────────────────────────── */}
      {lineCustomer && (
        <div className="space-y-4">
          {/* Clean greeting — no debug wording */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black text-white"
              style={{ background: branchColor }}
            >
              {lineCustomer.name.charAt(0)}
            </div>
            <p className="text-base font-bold text-gray-900">
              Hi, {lineCustomer.name.split(' ')[0]}!
            </p>
            <p className="text-sm text-gray-400 mt-0.5">Ready to add your points</p>
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
            className="w-full h-14 rounded-2xl text-base font-bold text-white disabled:opacity-40"
            style={{ background: branchColor }}
          >
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Adding…</span>
              : 'Claim Points'
            }
          </button>
        </div>
      )}

      {/* ── Phone fallback ──────────────────────────────────────────────────── */}
      {!lineCustomer && (
        <div className="space-y-4">
          {lineNotFound && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Enter your registered phone number to claim.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone number
            </label>
            <div className="relative">
              <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(null) }}
                placeholder="0812345678"
                className="w-full h-14 pl-11 pr-4 rounded-xl border border-gray-200 text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors"
              />
            </div>

            {/* Customer confirmed — clean state, no debug text */}
            {phoneMatched && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: branchColor }}
                >
                  {phoneMatched.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{phoneMatched.name}</p>
                  <p className="text-xs text-gray-400">Ready to add {points} point{points !== 1 ? 's' : ''}</p>
                </div>
                <CheckCircle size={18} className="ml-auto flex-shrink-0 text-emerald-500" />
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
            className="w-full h-14 rounded-2xl text-base font-bold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: resolved ? branchColor : '#9ca3af' }}
          >
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Adding…</span>
              : 'Claim Points'
            }
          </button>

          {!phoneMatched && (
            <p className="text-center text-sm text-gray-400">
              Not a member yet? Ask staff to sign you up.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
