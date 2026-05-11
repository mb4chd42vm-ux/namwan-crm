'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown, Users, CheckCircle } from 'lucide-react'
import { useLanguage } from '@/components/i18n/LanguageProvider'

export default function ExportMembersButton() {
  const { t } = useLanguage()
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
        className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-cream-300 px-3 py-1.5 text-xs font-medium text-cocoa-600 hover:border-cream-400 hover:text-cocoa-900 transition-colors shadow-sm"
      >
        <Download size={11} />
        {t.members.exportData}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-56 rounded-xl border border-cream-200 bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-cream-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-cocoa-400">
              {t.members.export.lookalike}
            </p>
          </div>
          <a
            href="/api/export/members-lookalike"
            download
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-cream-50 transition-colors text-xs text-cocoa-700"
            onClick={() => setOpen(false)}
          >
            <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-medium">{t.members.export.consenting}</p>
              <p className="text-[10px] text-cocoa-400">marketing_consent = true only</p>
            </div>
          </a>
          <a
            href="/api/export/members-lookalike?all=1"
            download
            className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-cream-50 transition-colors text-xs text-cocoa-700 border-t border-cream-50"
            onClick={() => setOpen(false)}
          >
            <Users size={13} className="text-cocoa-400 flex-shrink-0" />
            <div>
              <p className="font-medium">{t.members.export.allActive}</p>
              <p className="text-[10px] text-cocoa-400">includes non-consenting</p>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
