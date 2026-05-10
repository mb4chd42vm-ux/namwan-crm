'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export default function CustomerSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue]   = useState(defaultValue)
  const [isPending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(q: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (q.trim()) params.set('q', q.trim())
      else params.delete('q')
      // reset to page 1 on new search
      params.delete('segment')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    }, 280)
  }

  function clear() {
    setValue('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative">
      <Search
        size={13}
        className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
          isPending ? 'text-brand-500 animate-pulse' : 'text-gray-400'
        }`}
      />
      <input
        type="search"
        value={value}
        onChange={e => { setValue(e.target.value); update(e.target.value) }}
        placeholder="Search name or phone…"
        className="h-9 w-56 rounded-xl border border-gray-200 bg-white pl-8 pr-8 text-xs placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 transition-colors"
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}
