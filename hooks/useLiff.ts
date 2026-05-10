'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiffProfile {
  userId:      string
  displayName: string
  pictureUrl?: string
}

export type LiffStatus =
  | 'loading'       // LIFF SDK initializing
  | 'unavailable'   // NEXT_PUBLIC_LIFF_ID not set
  | 'error'         // liff.init() threw, or getProfile() failed
  | 'not_logged_in' // outside LINE app and no active session
  | 'ready'         // profile available

export interface LiffHook {
  status:     LiffStatus
  profile:    LiffProfile | null
  error:      string | null
  isInClient: boolean   // true when running inside the LINE app
  isLoggedIn: boolean   // true when there is an active LIFF access token
  login:      () => void
  logout:     () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiff(): LiffHook {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  const [status,     setStatus]     = useState<LiffStatus>(liffId ? 'loading' : 'unavailable')
  const [profile,    setProfile]    = useState<LiffProfile | null>(null)
  const [error,      setError]      = useState<string | null>(
    liffId ? null : 'NEXT_PUBLIC_LIFF_ID is not configured',
  )
  const [isInClient, setIsInClient] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Stable refs to liff SDK so login/logout work after init without re-running the effect
  const liffRef          = useRef<{ login: (o?: { redirectUri?: string }) => void; logout: () => void; isLoggedIn: () => boolean } | null>(null)
  // Guard: only auto-login once per mount to prevent infinite redirect loops
  const autoLoginFiredRef = useRef(false)

  useEffect(() => {
    if (!liffId) return

    let cancelled = false

    ;(async () => {
      try {
        const liff = (await import('@line/liff')).default
        liffRef.current = liff

        await liff.init({ liffId })
        if (cancelled) return

        const inClient = liff.isInClient()
        const loggedIn = liff.isLoggedIn()

        setIsInClient(inClient)
        setIsLoggedIn(loggedIn)

        if (!loggedIn) {
          if (inClient && !autoLoginFiredRef.current) {
            // Inside the LINE app but somehow no token — trigger login once.
            // The LINE app will resolve this instantly and redirect back with a token.
            autoLoginFiredRef.current = true
            liff.login({ redirectUri: window.location.href })
            return // page navigates away; effect cleanup runs when it returns
          }

          // Browser with no session → surface login button, never auto-redirect
          setStatus('not_logged_in')
          return
        }

        // Already logged in (in-client or browser OAuth session)
        const p = await liff.getProfile()
        if (cancelled) return

        setProfile({
          userId:      p.userId,
          displayName: p.displayName,
          pictureUrl:  p.pictureUrl ?? undefined,
        })
        setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'LIFF initialization failed')
          setStatus('error')
        }
      }
    })()

    return () => { cancelled = true }
  }, [liffId]) // intentionally stable — liffId never changes at runtime

  function login() {
    if (liffRef.current) {
      liffRef.current.login({ redirectUri: window.location.href })
    }
  }

  function logout() {
    if (liffRef.current && liffRef.current.isLoggedIn()) {
      liffRef.current.logout()
      setStatus('not_logged_in')
      setProfile(null)
      setIsLoggedIn(false)
    }
  }

  return { status, profile, error, isInClient, isLoggedIn, login, logout }
}
