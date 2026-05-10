'use client'

import { useRouter } from 'next/navigation'
import { Star, Phone, ChevronRight } from 'lucide-react'
import { SEGMENT_META, type Segment } from '@/lib/segments'
import { fmt } from '@/data/mock'

interface Customer {
  id: string
  name: string | null
  phone: string | null
  segment: string           // pre-computed by parent
  home_branch_id: string | null
  total_points: number
  visit_count: number
  last_visit_at: string | null
  branch: { id: string; name: string; color_hex: string } | null
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-100 text-brand-800 rounded not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function CustomerTableBody({
  customers,
  query,
}: {
  customers: Customer[]
  query: string
}) {
  const router = useRouter()

  return (
    <tbody className="divide-y divide-gray-50">
      {customers.map(c => {
        const m         = SEGMENT_META[c.segment as Segment] ?? SEGMENT_META['active']
        const lastVisit = c.last_visit_at
          ? new Date(c.last_visit_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
          : '—'

        return (
          <tr
            key={c.id}
            onClick={() => router.push(`/customers/${encodeURIComponent(c.id)}`)}
            className="hover:bg-brand-50/60 transition-colors cursor-pointer group"
          >
            {/* Member */}
            <td className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[11px] font-bold text-white">
                  {c.name?.charAt(0) ?? '?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                    {highlight(c.name ?? '', query)}
                  </p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Phone size={9} />
                    {highlight(c.phone ?? '', query)}
                  </p>
                </div>
              </div>
            </td>

            {/* Segment */}
            <td className="px-4 py-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${m.bg} ${m.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                {m.label}
              </span>
            </td>

            {/* Branch */}
            <td className="px-4 py-3 hidden sm:table-cell">
              {c.branch ? (
                <span
                  className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: c.branch.color_hex }}
                >
                  {c.branch.name.split(' ')[0]}
                </span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </td>

            {/* Points */}
            <td className="px-4 py-3">
              <div className="flex items-center gap-1 text-amber-700 font-semibold">
                <Star size={9} className="text-amber-500 fill-amber-400" />
                {fmt(c.total_points ?? 0)}
              </div>
            </td>

            {/* Visits */}
            <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
              {c.visit_count ?? 0}
            </td>

            {/* Last Visit */}
            <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
              {lastVisit}
            </td>

            {/* Arrow */}
            <td className="pr-3">
              <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}
