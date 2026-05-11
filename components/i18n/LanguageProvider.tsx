'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getDictionary, DEFAULT_LANG, LANG_COOKIE, type Lang, type Dict } from '@/lib/i18n'

interface LangContextValue {
  lang: Lang
  t: Dict
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function useLanguage(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}

interface Props {
  children: ReactNode
  initialLang?: Lang
}

export default function LanguageProvider({ children, initialLang }: Props) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (initialLang) return initialLang
    if (typeof window === 'undefined') return DEFAULT_LANG
    return (localStorage.getItem(LANG_COOKIE) as Lang | null) ?? DEFAULT_LANG
  })

  const router = useRouter()

  // Sync from localStorage on hydration (handles SSR mismatch)
  useEffect(() => {
    if (initialLang) return
    const stored = localStorage.getItem(LANG_COOKIE) as Lang | null
    if (stored && stored !== lang) setLangState(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    localStorage.setItem(LANG_COOKIE, next)
    // Set cookie so server components can read it
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
  }, [router])

  const value: LangContextValue = {
    lang,
    t: getDictionary(lang),
    setLang,
  }

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
