'use client'

import { useState, useTransition, useEffect } from 'react'
import { Star, CheckCircle, AlertTriangle, Phone, Loader2 } from 'lucide-react'
import { claimQRToken, lookupAndClaimByPhone, type ClaimResult } from '@/app/actions/qrClaims'
import { useLiff } from '@/hooks/useLiff'

interface ResolvedCustomer { id: string; name: string; via: 'line' }

const LINE_ICON = (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white flex-shrink-0" aria-hidden>
    <path d="M12 2C6.48 2 2 6.16 2 11.25c0 4.58 3.87 8.4 9.08 9.12.35.07.84.23.96.52.11.26.07.67.03.94l-.15.91c-.05.26-.22 1.03.9.56 1.12-.47 6.05-3.56 8.25-6.1C22.66 15.01 22 13.2 22 11.25 22 6.16 17.52 2 12 2z" />
  </svg>
)

export default function ClaimForm({
  token,
  drinkQuantity,
  points,
  branchName,
  branchColor,
}: {
  token:         string
  drinkQuantity: number
  points:        number
  branchName:    string
  branchColor:   string
}) {
  const [isPending, startTransition] = useTransition()
  const [phone,        setPhone]        = useState('')
  const [error,        setError]        = useState<string | null>(null)
  const [phoneNotFound, setPhoneNotFound] = useState(false)
  const [claimed,      setClaimed]      = useState<ClaimResult | null>(null)

  const liff = useLiff()
  const [lineCustomer,  setLineCustomer]  = useState<ResolvedCustomer | null>(null)
  const [lineCheckDone, setLineCheckDone] = useState(false)
  const [lineNotFound,  setLineNotFound]  = useState(false)

  // Identify via LINE if running inside LIFF
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
        // silent — fall through to phone entry
      } finally {
        setLineCheckDone(true)
      }
    })()
  }, [liff.status, liff.profile])

  const liffPending = !lineCheckDone && liff.status === 'loading'

  // ── LINE-identified submit ─────────────────────────────────────────────────
  function submitViaLine() {
    if (!lineCustomer) return
    const fd = new FormData()
    fd.append('token',       token)
    fd.append('customer_id', lineCustomer.id)
    setError(null)
    startTransition(async () => {
      try {
        const res = await claimQRToken(fd)
        setClaimed({ ...res, customerName: lineCustomer.name })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    })
  }

  // ── Phone submit — lookup + claim happens server-side ──────────────────────
  function submitViaPhone() {
    if (!phone.trim()) { setError('Enter your phone number'); return }
    const fd = new FormData()
    fd.append('token', token)
    fd.append('phone', phone.trim())
    setError(null)
    startTransition(async () => {
      try {
        const res = await lookupAndClaimByPhone(fd)
        if ('notFound' in res && res.notFound) {
          setPhoneNotFound(true)
        } else {
          setClaimed(res as ClaimResult)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    })
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (claimed) {
    return (
      <div className="flex flex-col items-center gap-7 py-6 text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: `${branchColor}22` }}
        >
          <CheckCircle size={52} style={{ color: branchColor }} />
        </div>

        <div className="space-y-1.5">
          {claimed.customerName && (
            <p className="text-base font-semibold text-gray-700">
              Hi, {claimed.customerName.split(' ')[0]}!
            </p>
          )}
          <p className="text-3xl font-black text-gray-900">
            +{claimed.points} point{claimed.points !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-gray-500">
            {claimed.drinkQuantity} drink{claimed.drinkQuantity !== 1 ? 's' : ''} · {branchName}
          </p>
        </div>

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

  // ── LIFF loading ─────────────────────────────────────────────────────────
  if (liffPending) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 size={28} className="text-gray-300 animate-spin" />
        <p className="text-sm text-gray-400">Setting up…</p>
      </div>
    )
  }

  // ── Phone not found — redirect to LINE registration ───────────────────────
  if (phoneNotFound) {
    const liffId  = process.env.NEXT_PUBLIC_LIFF_ID
    const lineUrl = liffId
      ? `https://liff.line.me/${liffId}?claim_token=${encodeURIComponent(token)}`
      : null

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

        {/* Not found card */}
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-5 py-5 space-y-1">
          <p className="text-sm font-bold text-amber-900 leading-snug">
            ยังไม่พบเบอร์นี้ในระบบสมาชิก
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            กรุณาสมัครสมาชิกผ่าน LINE ก่อนรับแต้ม
          </p>
        </div>

        {lineUrl ? (
          <a
            href={lineUrl}
            className="w-full h-14 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2.5 active:opacity-80 transition-opacity"
            style={{ background: '#06C755' }}
          >
            {LINE_ICON}
            สมัครผ่าน LINE เพื่อรับแต้ม
          </a>
        ) : (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-center">
            <p className="text-sm text-gray-600">กรุณาติดต่อพนักงานเพื่อสมัครสมาชิก</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setPhoneNotFound(false); setError(null) }}
          className="w-full text-center text-sm text-gray-400 py-2"
        >
          ใช้เบอร์อื่น
        </button>
      </div>
    )
  }

  // ── Phone view (default) ──────────────────────────────────────────────────
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

      {/* ── LINE-identified path ──────────────────────────────────────────── */}
      {lineCustomer && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black text-white"
              style={{ background: branchColor }}
            >
              {lineCustomer.name.charAt(0)}
            </div>
            <p className="text-base font-bold text-gray-900">Hi, {lineCustomer.name.split(' ')[0]}!</p>
            <p className="text-sm text-gray-400 mt-0.5">Ready to add your points</p>
          </div>

          {error && <ErrorBanner message={error} />}

          <button
            type="button"
            onClick={submitViaLine}
            disabled={isPending}
            className="w-full h-14 rounded-2xl text-base font-bold text-white disabled:opacity-40"
            style={{ background: branchColor }}
          >
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Adding…</span>
              : 'Claim Points'
            }
          </button>
        </div>
      )}

      {/* ── Phone path ───────────────────────────────────────────────────── */}
      {!lineCustomer && (
        <div className="space-y-4">
          {lineNotFound && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">Enter your registered phone number to claim.</p>
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
                onKeyDown={e => { if (e.key === 'Enter') submitViaPhone() }}
                placeholder="0812345678"
                className="w-full h-14 pl-11 pr-4 rounded-xl border border-gray-200 text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors"
              />
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <button
            type="button"
            onClick={submitViaPhone}
            disabled={isPending || phone.trim().length < 8}
            className="w-full h-14 rounded-2xl text-base font-bold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: branchColor }}
          >
            {isPending
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Checking…</span>
              : 'Claim Points'
            }
          </button>
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}
