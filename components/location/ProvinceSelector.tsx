'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, Search, X, MapPin } from 'lucide-react'
import { REGIONS, type Region } from '@/data/thailand-provinces'

export interface LocationValue {
  province: string
  region:   string
  regionId: string
}

interface Props {
  value:    LocationValue | null
  onChange: (v: LocationValue | null) => void
}

type Step = 'region' | 'province'

export default function ProvinceSelector({ value, onChange }: Props) {
  const [step,   setStep]   = useState<Step>('region')
  const [region, setRegion] = useState<Region | null>(null)
  const [search, setSearch] = useState('')

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function selectRegion(e: React.MouseEvent, r: Region) {
    e.preventDefault()
    e.stopPropagation()
    setRegion(r)
    setSearch('')
    setStep('province')
  }

  function selectProvince(e: React.MouseEvent, p: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!region) return
    onChange({
      province: p,
      region:   region.label,
      regionId: region.id,
    })
  }

  function goBack(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setStep('region')
    setSearch('')
  }

  function clearSelection(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const r = value ? (REGIONS.find(r => r.id === value.regionId) ?? null) : null
    setRegion(r)
    setStep(r ? 'province' : 'region')
    setSearch('')
    onChange(null)
  }

  function clearSearch(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSearch('')
  }

  // ── Already has a value → show summary chip ──────────────────────────────────
  if (value) {
    return (
      <button
        type="button"
        onClick={clearSelection}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left active:scale-[0.98] transition-transform"
      >
        <MapPin size={16} className="text-brand-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-800 truncate">{value.province}</p>
          <p className="text-xs text-brand-500">{value.region}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
          Change
        </span>
      </button>
    )
  }

  // ── Step 1: Region picker ─────────────────────────────────────────────────────
  if (step === 'region') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {REGIONS.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={e => selectRegion(e, r)}
              className="flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3.5 py-3.5 text-left hover:border-brand-300 hover:bg-brand-50 active:scale-[0.97] transition-all"
            >
              <span className="text-xl leading-none flex-shrink-0" aria-hidden>{r.emoji}</span>
              <span className="text-xs font-semibold text-gray-800 leading-snug">{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Province picker ───────────────────────────────────────────────────
  // region must be non-null here (step === 'province' only set via selectRegion)
  const provinces: string[] = region?.provinces ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return provinces
    return provinces.filter(p => p.toLowerCase().includes(q))
  }, [provinces, search])

  return (
    <div className="space-y-3">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0"
        >
          <ChevronLeft size={13} />
          <span aria-hidden>{region?.emoji ?? ''}</span>
          {region?.label ?? 'Back'}
        </button>
      </div>

      {/* Search — no autoFocus (crashes LINE iOS WebView) */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
          placeholder="Search province…"
          className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors bg-white"
        />
        {search.length > 0 && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Province chips */}
      {filtered.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-4">
          No provinces match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-0.5">
          {filtered.map(p => (
            <button
              key={p}
              type="button"
              onClick={e => selectProvince(e, p)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 active:scale-[0.97] transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
