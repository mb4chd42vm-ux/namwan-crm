'use client'

import { useState, useTransition, useRef } from 'react'
import { QrCode, Star, RefreshCw, CheckCircle, Copy, Minus, Plus, Clock } from 'lucide-react'
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

  const pointsEarned   = drinks
  const selectedBranch = branches.find(b => b.id === branchId)

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

  return (
    <div className="mx-auto w-full max-w-md">

      {result ? (
        /* ── QR display ── */
        <div className="rounded-3xl bg-white border border-cream-200 shadow-sm p-7 text-center space-y-6">

          {/* Header */}
          <div>
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-brand-50 mb-4">
              <QrCode size={22} className="text-brand-600" />
            </div>
            <p className="text-[20px] font-bold text-cocoa-900">Scan to Claim Points</p>
            <p className="text-[13px] text-cocoa-400 mt-1.5">
              {drinks} drink{drinks !== 1 ? 's' : ''} · +{pointsEarned} point{pointsEarned !== 1 ? 's' : ''}
            </p>
          </div>

          {/* QR code */}
          <div
            className="mx-auto w-full max-w-[280px] flex items-center justify-center rounded-2xl border-4 border-cream-200 bg-white p-4 [&>svg]:w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: result.qrSvg }}
          />

          {/* Timer pill */}
          <div className="flex items-center justify-center gap-2 rounded-xl bg-sand-100 border border-sand-200 px-5 py-3">
            <Clock size={13} className="text-cocoa-500" />
            <span className="text-[13px] font-semibold text-cocoa-700 tabular-nums">
              Expires at {new Date(result.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' '}· ~{expiresIn} min
            </span>
          </div>

          {/* Copy link */}
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-cream-300 bg-cream-50 h-12 text-[13px] font-semibold text-cocoa-600 hover:bg-cream-100 transition-colors"
          >
            {copied
              ? <><CheckCircle size={14} className="text-emerald-600" /> Copied!</>
              : <><Copy size={14} /> Copy claim link</>
            }
          </button>

          {/* Generate another */}
          <button
            onClick={reset}
            className="flex items-center gap-2 mx-auto text-[13px] text-brand-600 hover:text-brand-700 font-semibold py-1"
          >
            <RefreshCw size={13} /> Generate another
          </button>
        </div>

      ) : (
        /* ── Form ── */
        <div className="rounded-3xl bg-white border border-cream-200 shadow-sm p-6 space-y-7">

          {/* Branch selector */}
          <div>
            <label className="block text-[11px] font-semibold text-cocoa-500 uppercase tracking-[0.12em] mb-3">
              Branch
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {branches.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchId(b.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-semibold transition-all active:scale-[0.97] ${
                    branchId === b.id
                      ? 'border-transparent text-white shadow-md'
                      : 'border-cream-300 text-cocoa-600 bg-white hover:border-cream-400'
                  }`}
                  style={branchId === b.id ? { background: b.color_hex } : {}}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: branchId === b.id ? 'rgba(255,255,255,0.55)' : b.color_hex }}
                  />
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Drinks counter */}
          <div>
            <label className="block text-[11px] font-semibold text-cocoa-500 uppercase tracking-[0.12em] mb-1">
              Drinks to Award
            </label>
            <p className="text-[12px] text-cocoa-400 mb-4">1 drink = 1 point earned by customer</p>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-cream-300 bg-cream-50 p-4">
              <button
                type="button"
                onClick={() => setDrinks(d => Math.max(1, d - 1))}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-white border border-cream-300 text-cocoa-700 hover:border-cream-400 active:scale-95 transition-all shadow-sm"
              >
                <Minus size={20} />
              </button>

              <div className="text-center">
                <p className="text-[52px] font-black text-cocoa-900 leading-none">{drinks}</p>
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-700">
                    <Star size={9} className="fill-brand-400 text-brand-400" />
                    +{pointsEarned} point{pointsEarned !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrinks(d => d + 1)}
                className="flex h-14 w-14 items-center justify-center rounded-xl text-white active:scale-95 transition-all shadow-md"
                style={{ background: selectedBranch?.color_hex ?? '#8A2418' }}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-3 rounded-xl bg-cream-50 border border-cream-200 px-4 py-3.5">
            <Clock size={13} className="text-cocoa-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-cocoa-500 leading-relaxed">
              QR expires 5 minutes after generation and can only be claimed once.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-[13px] text-brand-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending || drinks <= 0 || !branchId}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-brand-700 h-14 text-[15px] font-bold text-white hover:bg-brand-800 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand-900/20"
          >
            <QrCode size={17} />
            {isPending ? 'Generating…' : `Generate QR · ${drinks} drink${drinks !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
