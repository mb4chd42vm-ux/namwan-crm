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

// A valid redeem token is a 48-char hex string (randomBytes(24).toString('hex'))
const TOKEN_RE = /^[0-9a-f]{48}$/i

type CameraState = 'init' | 'requesting' | 'scanning' | 'error' | 'denied'

export default function ScannerClient() {
  const router = useRouter()

  const [mode,        setMode]        = useState<'camera' | 'manual'>('camera')
  const [cameraState, setCameraState] = useState<CameraState>('init')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [manualErr,   setManualErr]   = useState<string | null>(null)

  // Debug panel state
  const [debugRaw,    setDebugRaw]    = useState<string | null>(null)
  const [debugToken,  setDebugToken]  = useState<string | null>(null)
  const [debugDetail, setDebugDetail] = useState<string | null>(null)

  const scannerRef = useRef<Html5QrcodeInstance | null>(null)
  const stoppedRef = useRef(false)

  // ── Token handler ────────────────────────────────────────────────────────────

  function handleQrValue(raw: string) {
    if (stoppedRef.current) return
    stoppedRef.current = true

    const trimmed = raw.trim()
    setDebugRaw(trimmed)

    stopScanner()

    // If it's a full URL, navigate to its pathname directly
    try {
      const url = new URL(trimmed)
      setDebugDetail(`URL pathname: ${url.pathname}`)
      setDebugToken(null)
      router.push(url.pathname)
      return
    } catch {
      // Not a URL — fall through
    }

    // Otherwise expect a raw 48-char hex token
    if (TOKEN_RE.test(trimmed)) {
      setDebugDetail(`Raw token`)
      setDebugToken(trimmed)
      router.push(`/points/redeem/confirm/${trimmed}`)
    } else {
      setDebugDetail(`Not a valid URL or token`)
      setDebugToken(null)
      setCameraState('error')
      setErrorMsg(`Could not read QR code.\nGot: ${trimmed.slice(0, 60)}`)
      stoppedRef.current = false // allow retry
    }
  }

  // ── Scanner lifecycle ────────────────────────────────────────────────────────

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

  // ── Manual entry ─────────────────────────────────────────────────────────────

  function submitManual() {
    const trimmed = manualToken.trim()

    // Full URL → navigate to pathname
    try {
      const url = new URL(trimmed)
      setManualErr(null)
      router.push(url.pathname)
      return
    } catch {
      // Not a URL
    }

    // Raw token
    if (TOKEN_RE.test(trimmed)) {
      setManualErr(null)
      router.push(`/points/redeem/confirm/${trimmed}`)
    } else {
      setManualErr(`Invalid format. Paste the full redeem URL or the 48-character token.`)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">

      {/* Mode toggle */}
      <div className="flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
        {[
          { id: 'camera', label: 'Camera Scan', icon: Camera   },
          { id: 'manual', label: 'Enter Token', icon: Keyboard },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id as 'camera' | 'manual')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              mode === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Camera panel ── */}
      {mode === 'camera' && (
        <div className="w-full space-y-3">
          <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-lg" style={{ aspectRatio: '1/1' }}>
            <div
              id={ELEMENT_ID}
              className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&_img]:hidden [&_select]:hidden [&_button]:hidden"
            />

            {/* Init / requesting overlay */}
            {(cameraState === 'init' || cameraState === 'requesting') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                <Loader2 size={32} className="text-amber-400 animate-spin" />
                <p className="text-sm text-white font-medium">
                  {cameraState === 'requesting' ? 'Requesting camera…' : 'Starting…'}
                </p>
              </div>
            )}

            {/* Scan overlay */}
            {cameraState === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-black/40" style={{ WebkitMaskImage: 'radial-gradient(circle, transparent 120px, black 121px)' }} />
                <div className="relative h-60 w-60">
                  {(['tl','tr','bl','br'] as const).map(c => (
                    <span key={c} className={`absolute h-9 w-9 border-white ${
                      c === 'tl' ? 'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl' :
                      c === 'tr' ? 'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl' :
                      c === 'bl' ? 'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl' :
                                   'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl'
                    }`} />
                  ))}
                  <div className="absolute left-2 right-2 h-[2px] bg-amber-400/90 rounded-full animate-[scanline_2s_ease-in-out_infinite]" />
                </div>
                <div className="absolute bottom-4 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-white font-medium">Scanning…</span>
                </div>
              </div>
            )}

            {/* Permission denied */}
            {cameraState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
                <ShieldAlert size={36} className="text-amber-400" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Camera access denied</p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Allow camera in browser settings, then tap Retry.
                  </p>
                </div>
                <button
                  onClick={() => { setCameraState('init'); startScanner() }}
                  className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-bold text-amber-900"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Error */}
            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
                <AlertTriangle size={36} className="text-red-400" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Scan failed</p>
                  <p className="text-xs text-white/50 leading-relaxed whitespace-pre-line">
                    {errorMsg ?? 'Could not read QR code'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCameraState('init'); startScanner() }}
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-amber-900"
                  >
                    Enter token
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400">
            Point camera at the customer's redemption QR code
          </p>

          {/* Debug panel — shown when a scan was attempted */}
          {debugRaw !== null && (
            <details className="rounded-xl border border-gray-200 bg-gray-50 text-xs">
              <summary className="cursor-pointer px-4 py-2.5 font-semibold text-gray-500 select-none">
                Scan debug info
              </summary>
              <div className="px-4 pb-3 space-y-1.5 text-gray-600 font-mono break-all">
                <div><span className="font-semibold text-gray-400">Raw:</span> {debugRaw}</div>
                <div><span className="font-semibold text-gray-400">Token:</span> {debugToken ?? 'not found'}</div>
                <div><span className="font-semibold text-gray-400">Detail:</span> {debugDetail}</div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Manual panel ── */}
      {mode === 'manual' && (
        <div className="w-full space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center space-y-2">
            <QrCode size={28} className="text-gray-300 mx-auto" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Paste the full redeem URL or the token from the customer's QR screen.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Redemption URL or Token
            </label>
            <input
              type="text"
              value={manualToken}
              onChange={e => { setManualToken(e.target.value); setManualErr(null) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitManual() } }}
              placeholder="Paste URL or token…"
              className="w-full h-12 rounded-xl border border-gray-200 px-4 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors"
            />
            {manualErr && <p className="mt-1.5 text-xs text-red-600">{manualErr}</p>}
          </div>

          <button
            onClick={submitManual}
            disabled={manualToken.trim().length < 10}
            className="w-full h-12 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Look up token
          </button>
        </div>
      )}
    </div>
  )
}
