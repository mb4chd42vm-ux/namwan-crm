'use client'

import { useTransition } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { login } from '@/app/actions/auth'

export default function LoginForm({ error }: { error: string | null }) {
  const [isPending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      await login(formData)
    })
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 h-13 text-base shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 h-13 text-base shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">{decodeURIComponent(error)}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 h-13 text-base font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Signing in…
          </>
        ) : (
          'Sign In →'
        )}
      </button>
    </form>
  )
}
