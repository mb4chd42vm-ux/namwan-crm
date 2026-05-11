'use client'

import { useTransition } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { login } from '@/app/actions/auth'
import { useLanguage } from '@/components/i18n/LanguageProvider'

export default function LoginForm({ error }: { error: string | null }) {
  const [isPending, startTransition] = useTransition()
  const { t } = useLanguage()

  function submit(formData: FormData) {
    startTransition(async () => {
      await login(formData)
    })
  }

  return (
    <form action={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-[12px] font-semibold text-cocoa-600 uppercase tracking-wide">
          {t.auth.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.auth.emailPlaceholder}
          className="block w-full rounded-xl border border-cream-300 bg-white px-4 h-12 text-[14px] text-cocoa-900 shadow-sm placeholder:text-cocoa-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-all"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-[12px] font-semibold text-cocoa-600 uppercase tracking-wide">
          {t.auth.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={t.auth.passwordPlaceholder}
          className="block w-full rounded-xl border border-cream-300 bg-white px-4 h-12 text-[14px] text-cocoa-900 shadow-sm placeholder:text-cocoa-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-all"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
          <AlertCircle size={14} className="text-brand-500 flex-shrink-0" />
          <p className="text-[13px] text-brand-700">{decodeURIComponent(error)}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 h-12 text-[14px] font-semibold text-white shadow-md shadow-brand-900/20 hover:bg-brand-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t.auth.signingIn}
          </>
        ) : (
          t.auth.signIn
        )}
      </button>
    </form>
  )
}
