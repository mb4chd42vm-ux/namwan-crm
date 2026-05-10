'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, Star, Loader2 } from 'lucide-react'

interface Branch { id: string; name: string; color_hex: string }

interface TokenData {
  valid:            boolean
  reason?:          string
  request_id?:      string
  reward_name?:     string
  points_required?: number
  expires_at?:      string
  customer?: {
    id:           string
    name:         string
    phone:        string
    total_points: number
  }
  // debug fields passed through from server
  _debug?: {
    token:     string
    status?:   string
    found:     boolean
    expires_at?: string
  }
}

const POINTS_PER_DRINK = 10

export default function ConfirmClient({
  token,
  tokenData,
  branches,
}: {
  token:     string
  tokenData: TokenData
  branches:  Branch[]
}) {
  const router = useRouter()
  const [branchId,   setBranchId]   = useState(branches[0]?.id ?? '')
  const [isPending,  start]         = useTransition()
  const [confirmed,  setConfirmed]  = useState(false)
  const [newBalance, setNewBalance] = useState<number | null>(null)
  const [error,      setError]      = useState<string | null>(null)

  // ── Success state ──────────────────────────────────────────────────────────
  if (confirmed && newBalance !== null) {
    const customer = tokenData.customer
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-8 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mx-auto">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-bold text-emerald-800">Redemption Confirmed!</p>
          {customer && (
            <p className="text-sm text-emerald-700">
              1 free drink awarded to <span className="font-semibold">{customer.name}</span>
            </p>
          )}
        </div>
        <div className="rounded-xl bg-white border border-emerald-100 px-5 py-4 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Points deducted</span>
            <span className="font-bold text-red-600">−{POINTS_PER_DRINK} pts</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">New balance</span>
            <span className="font-bold text-gray-900">{newBalance} pts</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/points/redeem/scan')}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Scan another
          </button>
          <button
            type="button"
            onClick={() => router.push('/points')}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Back to Points
          </button>
        </div>
      </div>
    )
  }

  // ── Invalid / not found ────────────────────────────────────────────────────
  if (!tokenData.valid) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-8 text-center space-y-3">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <p className="text-base font-bold text-red-700">
            {tokenData.reason ?? 'Redeem QR not found or expired'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/points/redeem/scan')}
            className="mt-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
          >
            Scan another QR
          </button>
        </div>

        {/* Debug panel */}
        <DebugPanel token={token} debug={tokenData._debug} />
      </div>
    )
  }

  const customer     = tokenData.customer!
  const balanceAfter = customer.total_points - POINTS_PER_DRINK
  const expiresStr   = tokenData.expires_at
    ? new Date(tokenData.expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  function confirm() {
    if (!branchId) { setError('Please select a branch'); return }
    setError(null)
    start(async () => {
      try {
        // POST /api/redeem/[token]  — confirm endpoint lives here, NOT /confirm sub-path
        const res  = await fetch(`/api/redeem/${token}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ branch_id: branchId }),
        })
        let data: Record<string, unknown> = {}
        try {
          data = await res.json()
        } catch {
          setError(`Server error (HTTP ${res.status}) — check Vercel logs`)
          return
        }
        if (!res.ok) {
          setError((data.error as string) ?? `Confirmation failed (HTTP ${res.status})`)
          return
        }
        setNewBalance(data.new_balance as number)
        setConfirmed(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Connection error — please try again')
      }
    })
  }

  return (
    <div className="space-y-5">

      {/* Customer / reward card */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Redemption Request</p>
          {expiresStr && <p className="text-[11px] text-amber-600">Expires {expiresStr}</p>}
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Customer */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {customer.name.charAt(0)}
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{customer.name}</p>
              <p className="text-xs text-gray-400">{customer.phone}</p>
            </div>
          </div>

          {/* Points summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Balance</p>
              <p className="text-lg font-black text-gray-900">{customer.total_points}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-center">
              <p className="text-[10px] text-red-400 uppercase tracking-wide">Deduct</p>
              <p className="text-lg font-black text-red-600">−{POINTS_PER_DRINK}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wide">After</p>
              <p className={`text-lg font-black ${balanceAfter < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {Math.max(0, balanceAfter)}
              </p>
            </div>
          </div>

          {/* Reward */}
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <Star size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{tokenData.reward_name ?? '1 Free Drink'}</p>
              <p className="text-xs text-amber-600">Requires {tokenData.points_required ?? POINTS_PER_DRINK} points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branch selector */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Branch *
        </label>
        <div className="flex gap-2 flex-wrap">
          {branches.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchId(b.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
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
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/points/redeem/scan')}
          disabled={isPending}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={isPending || !branchId || customer.total_points < POINTS_PER_DRINK}
          className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending
            ? <><Loader2 size={14} className="animate-spin" /> Confirming…</>
            : 'Confirm & Deduct Points'
          }
        </button>
      </div>

      {/* Debug panel — always visible so staff can diagnose issues */}
      <DebugPanel token={token} debug={tokenData._debug} />
    </div>
  )
}

// ── Debug panel ──────────────────────────────────────────────────────────────

function DebugPanel({ token, debug }: { token: string; debug?: TokenData['_debug'] }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-gray-50 text-xs">
      <summary className="cursor-pointer px-4 py-2.5 font-semibold text-gray-400 select-none">
        Debug info
      </summary>
      <div className="px-4 pb-3 space-y-1 text-gray-500 font-mono break-all">
        <div><span className="text-gray-400">token:</span> {token}</div>
        <div><span className="text-gray-400">found:</span> {debug?.found ? 'yes' : 'no'}</div>
        <div><span className="text-gray-400">status:</span> {debug?.status ?? '—'}</div>
        <div><span className="text-gray-400">expires_at:</span> {debug?.expires_at ?? '—'}</div>
      </div>
    </details>
  )
}
