'use client'

import { useLanguage } from './LanguageProvider'
import type { Lang } from '@/lib/i18n'

interface Props {
  /** Dark variant for use on deep-colored backgrounds (member page) */
  dark?: boolean
}

export default function LangToggle({ dark = false }: Props) {
  const { lang, setLang } = useLanguage()

  const options: Lang[] = ['th', 'en']

  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 text-[11px] font-semibold tracking-wide ${
        dark
          ? 'bg-white/15 text-white/80'
          : 'bg-cream-200 border border-cream-300 text-cocoa-500'
      }`}
    >
      {options.map((opt) => {
        const active = lang === opt
        return (
          <button
            key={opt}
            onClick={() => setLang(opt)}
            className={`rounded-full px-2.5 py-1 transition-all ${
              active
                ? dark
                  ? 'bg-white text-cocoa-900 shadow-sm'
                  : 'bg-white text-cocoa-900 shadow-sm'
                : dark
                ? 'text-white/60 hover:text-white'
                : 'text-cocoa-400 hover:text-cocoa-700'
            }`}
          >
            {opt.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
