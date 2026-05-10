'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Users, CheckCircle } from 'lucide-react'

export default function ExportMembersButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors shadow-sm"
      >
        <Download size={11} />
        Export
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Export for Lookalike
            </p>
          </div>
          <a
            href="/api/export/members-lookalike"
            download
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-xs text-gray-700"
            onClick={() => setOpen(false)}
          >
            <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-medium">Consenting members</p>
              <p className="text-[10px] text-gray-400">marketing_consent = true only</p>
            </div>
          </a>
          <a
            href="/api/export/members-lookalike?all=1"
            download
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-xs text-gray-700 border-t border-gray-50"
            onClick={() => setOpen(false)}
          >
            <Users size={13} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="font-medium">All active members</p>
              <p className="text-[10px] text-gray-400">includes non-consenting</p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
