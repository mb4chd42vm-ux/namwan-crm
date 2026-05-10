'use client'

import { useState, useTransition, useRef } from 'react'
import { QrCode, Coffee, Star, RefreshCw, CheckCircle, Copy, Minus, Plus } from 'lucide-react'
import { createQRToken } from '@/app/actions/qrClaims'

interface Branch { id: string; name: string; color_hex: string }

export default function QRCreateForm({
  branches,
  defaultBranchId,
  baseUrl,
}: {
  branches: Branch[]
  defaultBranchId?: string | null
  baseUrl: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]       = useState<string | null>(null)
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? '')
  const [drinks, setDrinks]     = useState(1)
  const [result, setResult]     = useState<{ token: string; expiresAt: string; qrSvg: string } | null>(null)
  const [copied, setCopied]     = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pointsEarned = drinks

  function reset() {
    setResult(null)
    setError(null)
    setDrinks(1)
  }

  function submit() {
    if (!branchId)   { setError('Please select a branch'); return }
    if (drinks <= 0) { setError('Enter at least 1 drink'); return }

    const fd = new FormData()
    fd.append('branch_id',      branchId)
    fd.append('drink_quantity', String(drinks))

    setError(null)
    startTransition(async () => {
      try {
        const res = await createQRToken(fd)
        const claimUrl = `${baseUrl}/claim/${res.token}`

        const svgRes = await fetch(`/api/qr?url=${encodeURIComponent(claimUrl)}`)
        const qrSvg  = await svgRes.text()

        setResult({ token: res.token, expiresAt: res.expiresAt, qrSvg })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  function copyLink() {
    if (!result) return
    navigator.clipboard.writeText(`${baseUrl}/claim/${result.token}`)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  const expiresIn = result
    ? Math.max(0, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 1000 / 60))
    : 0

  const selectedBranch = branches.find(b => b.id === branchId)

  return (
    <div className="mx-auto w-full max-w-md space-y-4">

      {result ? (
        /* ── QR display ── */
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 text-center space-y-5">
          <div>
            <p className="text-lg font-bold text-gray-900">Scan to Claim Points</p>
            <p className="text-sm text-gray-400 mt-1">
              Expires in ~{expiresIn} min · {drinks} drink{drinks !== 1 ? 's' : ''} = {pointsEarned} pt{pointsEarned !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Large QR code — responsive, max 320px */}
          <div
            className="mx-auto w-full max-w-[320px] flex items-center justify-center rounded-2xl border-4 border-amber-100 bg-white p-4 shadow-inner [&>svg]:w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: result.qrSvg }}
          />

          {/* Copy link — full width */}
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 h-12 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? <CheckCircle size={15} className="text-emerald-500" /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy claim link'}
          </button>

          {/* Expiry — full width */}
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
            QR expires at {new Date(result.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <button
            onClick={reset}
            className="flex items-center gap-2 mx-auto text-sm text-brand-600 hover:text-brand-700 font-semibold py-1"
          >
            <RefreshCw size={14} /> Generate another
          </button>
        </div>
      ) : (
        /* ── Form ── */
        <div className="rounded-2xl border border-white/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 space-y-6">

          {/* Branch selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Branch *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {branches.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchId(b.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                    branchId === b.id
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 text-gray-600 bg-white hover:border-gray-300'
                  }`}
                  style={branchId === b.id ? { background: b.color_hex } : {}}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: branchId === b.id ? 'rgba(255,255,255,0.6)' : b.color_hex }}
                  />
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Drinks counter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Drinks to Award *
              <span className="ml-1.5 normal-case font-normal text-gray-400">1 drink = 1 point</span>
            </label>

            {/* Large stepper for POS use */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-3">
              <button
                type="button"
                onClick={() => setDrinks(d => Math.max(1, d - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all text-xl font-bold"
              >
                <Minus size={20} />
              </button>

              <div className="text-center">
                <p className="text-4xl font-black text-gray-900 leading-none">{drinks}</p>
                <div className="mt-1.5">
                  {drinks > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      <Star size={10} className="fill-emerald-400 text-emerald-500" />
                      +{pointsEarned} point{pointsEarned !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">
                      <Coffee size={12} className="inline mr-1" />
                      drinks
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrinks(d => d + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white active:scale-95 transition-all"
                style={{ background: selectedBranch?.color_hex ?? '#c45f12' }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            QR code expires 5 minutes after generation and can only be claimed once.
          </p>

          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending || drinks <= 0 || !branchId}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 h-14 text-base font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <QrCode size={18} />
            {isPending ? 'Generating…' : `Generate QR · ${drinks} drink${drinks !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
