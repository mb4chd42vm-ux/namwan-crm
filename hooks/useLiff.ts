'use client'

import { useEffect, useState } from 'react'

export interface LiffProfile {
  userId:      string
  displayName: string
  pictureUrl?: string
}

export type LiffState =
  | { status: 'loading' }
  | { status: 'unavailable' }                            // no LIFF_ID configured
  | { status: 'error'; message: string }
  | { status: 'not_logged_in'; login: () => void }       // in browser, not yet authed
  | { status: 'ready'; profile: LiffProfile; inClient: boolean }

/**
 * Initialize LIFF and return the current auth state.
 *
 * @param forceLogin  When true, automatically triggers liff.login() if the
 *                    user is not yet authenticated (used on the /member page).
 *                    When false (default), returns status 'not_logged_in' so
 *                    the caller can decide what to do (used on /claim pages).
 */
export function useLiff(forceLogin = false): LiffState {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  const [state, setState] = useState<LiffState>(
    liffId ? { status: 'loading' } : { status: 'unavailable' },
  )

  useEffect(() => {
    if (!liffId) return

    let cancelled = false

    ;(async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })

        if (cancelled) return

        if (!liff.isLoggedIn()) {
          if (forceLogin) {
            liff.login({ redirectUri: window.location.href })
            return // page will redirect away
          }
          setState({
            status: 'not_logged_in',
            login: () => liff.login({ redirectUri: window.location.href }),
          })
          return
        }

        const profile = await liff.getProfile()
        if (cancelled) return

        setState({
          status: 'ready',
          profile: {
            userId:      profile.userId,
            displayName: profile.displayName,
            pictureUrl:  profile.pictureUrl ?? undefined,
          },
          inClient: liff.isInClient(),
        })
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'LIFF initialization failed',
          })
        }
      }
    })()

    return () => { cancelled = true }
  }, [liffId, forceLogin])

  return state
}
