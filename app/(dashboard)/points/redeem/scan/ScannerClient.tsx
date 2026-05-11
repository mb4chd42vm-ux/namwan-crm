'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Keyboard, Loader2, AlertTriangle, QrCode, ShieldAlert } from 'lucide-react'

type Html5QrcodeInstance = {
  start(
    cameraId: string | { facingMode: string },
    config: object,
    onSuccess: (text: string) => void,
    onError:   (msg: string) => void,
  ): Promise<void>
  stop():  Promise<void>
  clear(): void
}

const ELEMENT_ID = 'qr-scanner-region'
const TOKEN_RE   = /^[0-9a-f]{48}$/i

type CameraState = 'init' | 'requesting' | 'scanning' | 'error' | 'denied'

export default function ScannerClient() {
  const router = useRouter()

  const [mode,        setMode]        = useState<'camera' | 'manual'>('camera')
  const [cameraState, setCameraState] = useState<CameraState>('init')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [manualErr,   setManualErr]   = useState<string | null>(null)

  const [debugRaw,    setDebugRaw]    = useState<string | null>(null)
  const [debugToken,  setDebugToken]  = useState<string | null>(null)
  const [debugDetail, setDebugDetail] = useState<string | null>(null)

  const scannerRef = useRef<Html5QrcodeInstance | null>(null)
  const stoppedRef = useRef(false)

  function handleQrValue(raw: string) {
    if (stoppedRef.current) return
    stoppedRef.current = true

    const trimmed = raw.trim()
    setDebugRaw(trimmed)
    stopScanner()

    try {
      const url = new URL(trimmed)
      setDebugDetail(`URL pathname: ${url.pathname}`)
      setDebugToken(null)
      router.push(url.pathname)
      return
    } catch {}

    if (TOKEN_RE.test(trimmed)) {
      setDebugDetail(`Raw token`)
      setDebugToken(trimmed)
      router.push(`/points/redeem/confirm/${trimmed}`)
    } else {
      setDebugDetail(`Not a valid URL or token`)
      setDebugToken(null)
      setCameraState('error')
      setErrorMsg(`Could not read QR code.\nGot: ${trimmed.slice(0, 60)}`)
      stoppedRef.current = false
    }
  }

  async function startScanner() {
    stoppedRef.current = false
    setCameraState('requesting')
    setErrorMsg(null)
    setDebugRaw(null)
    setDebugToken(null)
    setDebugDetail(null)

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (stoppedRef.current) return

      const instance = new Html5Qrcode(ELEMENT_ID, { verbose: false })
      scannerRef.current = instance as unknown as Html5QrcodeInstance

      await instance.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (text: string) => handleQrValue(text),
        () => {},
      )

      if (!stoppedRef.current) setCameraState('scanning')
    } catch (e: unknown) {
      if (stoppedRef.current) return
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('notallowed')) {
        setCameraState('denied')
      } else {
        setCameraState('error')
        setErrorMsg(e instanceof Error ? e.message : 'Camera failed to start')
      }
    }
  }

  function stopScanner() {
    const s = scannerRef.current
    if (!s) return
    scannerRef.current = null
    s.stop().catch(() => {}).finally(() => { try { s.clear() } catch {} })
  }

  useEffect(() => {
    if (mode !== 'camera') return
    startScanner()
    return () => { stoppedRef.current = true; stopScanner() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function submitManual() {
    const trimmed = manualToken.trim()
    try {
      const url = new URL(trimmed)
      setManualErr(null)
      router.push(url.pathname)
      return
    } catch {}

    if (TOKEN_RE.test(trimmed)) {
      setManualErr(null)
      router.push(`/points/redeem/confirm/${trimmed}`)
    } else {
      setManualErr(`Invalid format. Paste the full redeem URL or the 48-character token.`)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">

      {/* Mode toggle */}
      <div className="flex w-full rounded-2xl border border-cream-300 bg-cream-100 p-1 gap-1">
        {[
          { id: 'camera', label: 'Camera Scan', icon: Camera   },
          { id: 'manual', label: 'Enter Token', icon: Keyboard },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id as 'camera' | 'manual')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all ${
              mode === id
                ? 'bg-white text-cocoa-900 shadow-sm'
                : 'text-cocoa-400 hover:text-cocoa-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Camera panel ── */}
      {mode === 'camera' && (
        <div className="w-full space-y-4">
          <div
            className="relative w-full overflow-hidden rounded-3xl shadow-xl shadow-cocoa-900/15"
            style={{ aspectRatio: '1/1', background: '#1A0C06' }}
          >
            <div
              id={ELEMENT_ID}
              className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&_img]:hidden [&_select]:hidden [&_button]:hidden"
            />

            {/* Init / requesting */}
            {(cameraState === 'init' || cameraState === 'requesting') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-cocoa-950/90">
                <Loader2 size={28} className="text-sand-300 animate-spin" />
                <p className="text-[13px] text-white/60 font-medium">
                  {cameraState === 'requesting' ? 'Requesting camera access…' : 'Starting camera…'}
                </p>
              </div>
            )}

            {/* Scan overlay */}
            {cameraState === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div
                  className="absolute inset-0 bg-cocoa-950/50"
                  style={{ WebkitMaskImage: 'radial-gradient(circle, transparent 115px, black 116px)' }}
                />
                {/* Corner markers */}
                <div className="relative h-60 w-60">
                  {(['tl','tr','bl','br'] as const).map(c => (
                    <span key={c} className={`absolute h-8 w-8 border-white/90 ${
                      c === 'tl' ? 'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl' :
                      c === 'tr' ? 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl' :
                      c === 'bl' ? 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl' :
                                   'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl'
                    }`} />
                  ))}
                  {/* Scan line */}
                  <div className="absolute left-0 right-0 h-[2px] rounded-full animate-[scanline_2s_ease-in-out_infinite]"
                    style={{ background: 'linear-gradient(90deg, transparent, #F5C842, transparent)' }}
                  />
                </div>
                {/* Status pill */}
                <div className="absolute bottom-5 flex items-center gap-2 rounded-full bg-cocoa-950/70 border border-white/10 px-4 py-2 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[12px] text-white/80 font-medium">Scanning for QR code…</span>
                </div>
              </div>
            )}

            {/* Permission denied */}
            {cameraState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-cocoa-950/95 p-7 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                  <ShieldAlert size={28} className="text-sand-300" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-bold text-white">Camera access denied</p>
                  <p className="text-[12px] text-white/50 leading-relaxed">
                    Allow camera in browser settings, then tap Retry.
                  </p>
                </div>
                <button
                  onClick={() => { setCameraState('init'); startScanner() }}
                  className="rounded-xl bg-brand-700 px-8 py-2.5 text-[13px] font-bold text-white active:scale-[0.97] transition-all"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Scan error */}
            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-cocoa-950/95 p-7 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                  <AlertTriangle size={28} className="text-brand-300" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-bold text-white">Scan failed</p>
                  <p className="text-[12px] text-white/50 leading-relaxed whitespace-pre-line">
                    {errorMsg ?? 'Could not read QR code'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCameraState('init'); startScanner() }}
                    className="rounded-xl bg-white/12 border border-white/15 px-5 py-2.5 text-[13px] font-semibold text-white"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className="rounded-xl bg-brand-700 px-5 py-2.5 text-[13px] font-bold text-white"
                  >
                    Enter token
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-[12px] text-cocoa-400">
            Point camera at the customer's redemption QR code
          </p>

          {/* Debug panel */}
          {debugRaw !== null && (
            <details className="rounded-xl border border-cream-300 bg-cream-50 text-[12px]">
              <summary className="cursor-pointer px-4 py-3 font-semibold text-cocoa-500 select-none">
                Scan debug info
              </summary>
              <div className="px-4 pb-3.5 pt-1 space-y-1.5 text-cocoa-600 font-mono break-all">
                <div><span className="font-semibold text-cocoa-400">Raw:</span> {debugRaw}</div>
                <div><span className="font-semibold text-cocoa-400">Token:</span> {debugToken ?? 'not found'}</div>
                <div><span className="font-semibold text-cocoa-400">Detail:</span> {debugDetail}</div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Manual panel ── */}
      {mode === 'manual' && (
        <div className="w-full space-y-4">
          <div className="rounded-2xl border border-cream-200 bg-cream-50 p-6 text-center space-y-2.5">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-cream-200">
              <QrCode size={20} className="text-cocoa-400" />
            </div>
            <p className="text-[13px] text-cocoa-500 leading-relaxed">
              Paste the full redeem URL or the token from the customer's QR screen.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-cocoa-500 uppercase tracking-widest mb-2">
              Redemption URL or Token
            </label>
            <input
              type="text"
              value={manualToken}
              onChange={e => { setManualToken(e.target.value); setManualErr(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitManual() } }}
              placeholder="Paste URL or token…"
              className="w-full h-12 rounded-xl border border-cream-300 bg-white px-4 text-[13px] font-mono text-cocoa-900 placeholder:text-cocoa-300 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-all"
            />
            {manualErr && <p className="mt-1.5 text-[12px] text-brand-600">{manualErr}</p>}
          </div>

          <button
            onClick={submitManual}
            disabled={manualToken.trim().length < 10}
            className="w-full h-12 rounded-xl bg-brand-700 text-[14px] font-semibold text-white hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-900/20"
          >
            Look up token →
          </button>
        </div>
      )}
    </div>
  )
}
