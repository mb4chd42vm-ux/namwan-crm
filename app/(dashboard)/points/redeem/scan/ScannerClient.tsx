'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Keyboard, Loader2, AlertTriangle, QrCode } from 'lucide-react'

// TypeScript shim for BarcodeDetector (not in lib.dom yet)
declare global {
  interface Window {
    BarcodeDetector: {
      new(opts: { formats: string[] }): {
        detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>
      }
      getSupportedFormats?(): Promise<string[]>
    }
  }
}

export default function ScannerClient() {
  const router     = useRouter()
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)

  const [mode,        setMode]        = useState<'camera' | 'manual'>('camera')
  const [cameraErr,   setCameraErr]   = useState<string | null>(null)
  const [scanning,    setScanning]    = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [manualErr,   setManualErr]   = useState<string | null>(null)

  const isBarcodeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  // ── Camera setup ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (mode !== 'camera' || !isBarcodeSupported) return

    let rafId: number
    let detector: ReturnType<typeof createDetector> | null = null

    function createDetector() {
      return new window.BarcodeDetector({ formats: ['qr_code'] })
    }

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        detector = createDetector()
        setScanning(true)
        tick()
      } catch (e) {
        setCameraErr(e instanceof Error ? e.message : 'Camera access denied')
      }
    }

    async function tick() {
      if (!videoRef.current || videoRef.current.readyState < 2 || !detector) {
        rafId = requestAnimationFrame(tick)
        return
      }
      try {
        const results = await detector.detect(videoRef.current)
        if (results.length > 0) {
          const raw = results[0].rawValue
          handleQrValue(raw)
          return // stop scanning
        }
      } catch {
        // detection failed on a frame — keep going
      }
      rafId = requestAnimationFrame(tick)
    }

    startCamera()

    return () => {
      cancelAnimationFrame(rafId)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setScanning(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── QR value handler ─────────────────────────────────────────────────────────

  function handleQrValue(raw: string) {
    // Stop camera
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)

    // Extract token from URL or use raw as token
    let token = raw.trim()
    try {
      const url = new URL(raw)
      const parts = url.pathname.split('/')
      token = parts[parts.length - 1]
    } catch {
      // raw is already the token
    }

    if (token) {
      router.push(`/points/redeem/confirm/${token}`)
    }
  }

  // ── Manual entry ─────────────────────────────────────────────────────────────

  function submitManual() {
    const t = manualToken.trim()
    if (t.length < 10) {
      setManualErr('Enter the full token from the QR code')
      return
    }
    setManualErr(null)
    router.push(`/points/redeem/confirm/${t}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">

      {/* Mode toggle */}
      <div className="flex w-full rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
        {[
          { id: 'camera', label: 'Camera Scan', icon: Camera },
          { id: 'manual', label: 'Enter Token',  icon: Keyboard },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id as 'camera' | 'manual')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              mode === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Camera view */}
      {mode === 'camera' && (
        <div className="w-full">
          {!isBarcodeSupported ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center space-y-2">
              <AlertTriangle size={24} className="text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-amber-800">Camera QR not supported</p>
              <p className="text-xs text-amber-600">
                BarcodeDetector is not available in this browser.
                Use "Enter Token" to paste the token manually, or switch to Chrome on Android/desktop.
              </p>
              <button
                onClick={() => setMode('manual')}
                className="mt-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Enter token manually
              </button>
            </div>
          ) : cameraErr ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-6 text-center space-y-2">
              <AlertTriangle size={24} className="text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-red-700">Camera error</p>
              <p className="text-xs text-red-500">{cameraErr}</p>
              <button
                onClick={() => setMode('manual')}
                className="mt-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
              >
                Enter token manually
              </button>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-black aspect-square w-full shadow-lg">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-52 w-52">
                  {/* Corner brackets */}
                  {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
                    <span
                      key={corner}
                      className={`absolute h-8 w-8 border-white ${
                        corner === 'tl' ? 'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg' :
                        corner === 'tr' ? 'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg' :
                        corner === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg' :
                                          'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg'
                      }`}
                    />
                  ))}
                  {/* Scanning line */}
                  {scanning && (
                    <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-amber-400/80 animate-bounce" />
                  )}
                </div>
              </div>
              {/* Status badge */}
              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
                  {scanning
                    ? <><div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-xs text-white font-medium">Scanning…</span></>
                    : <><Loader2 size={12} className="text-white animate-spin" /><span className="text-xs text-white">Starting camera…</span></>
                  }
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 text-center text-xs text-gray-400">
            Point camera at the customer's redemption QR code
          </p>
        </div>
      )}

      {/* Manual entry */}
      {mode === 'manual' && (
        <div className="w-full space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center space-y-2">
            <QrCode size={28} className="text-gray-300 mx-auto" />
            <p className="text-xs text-gray-500">
              Ask the customer to show their QR code screen.<br />
              Copy the token displayed or have them share the link.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Redemption Token
            </label>
            <input
              type="text"
              value={manualToken}
              onChange={e => { setManualToken(e.target.value); setManualErr(null) }}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
              placeholder="Paste token here…"
              className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors"
            />
            {manualErr && (
              <p className="mt-1.5 text-xs text-red-600">{manualErr}</p>
            )}
          </div>

          <button
            onClick={submitManual}
            disabled={manualToken.trim().length < 10}
            className="w-full h-11 rounded-xl bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Look up token
          </button>
        </div>
      )}
    </div>
  )
}
