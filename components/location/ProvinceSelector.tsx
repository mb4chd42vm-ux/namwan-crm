'use client'

import { useState } from 'react'
import { REGIONS } from '@/data/thailand-provinces'

export interface LocationValue {
  province: string
  region:   string
  regionId: string
}

interface Props {
  value:    LocationValue | null
  onChange: (v: LocationValue | null) => void
}

const SELECT_CLASS =
  'w-full h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:outline-none focus:border-brand-400 appearance-none'

export default function ProvinceSelector({ value, onChange }: Props) {
  const [regionId, setRegionId] = useState(value?.regionId ?? '')

  const selectedRegion = REGIONS.find(r => r.id === regionId) ?? null

  function handleRegionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setRegionId(id)
    onChange(null) // reset province when region changes
  }

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const province = e.target.value
    if (!province || !selectedRegion) return
    onChange({
      province,
      region:   selectedRegion.label,
      regionId: selectedRegion.id,
    })
  }

  return (
    <div className="space-y-3">
      {/* Region */}
      <select
        value={regionId}
        onChange={handleRegionChange}
        className={SELECT_CLASS}
      >
        <option value="">— Select region —</option>
        {REGIONS.map(r => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>

      {/* Province — only shown once a region is selected */}
      {selectedRegion && (
        <select
          value={value?.province ?? ''}
          onChange={handleProvinceChange}
          className={SELECT_CLASS}
        >
          <option value="">— Select province —</option>
          {selectedRegion.provinces.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}

      {/* Selected summary */}
      {value && (
        <p className="text-xs text-brand-700 font-medium px-1">
          {value.province} · {value.region}
        </p>
      )}
    </div>
  )
}
