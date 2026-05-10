'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export interface Branch { id: string; name: string; color_hex: string }

const fmt = (v: number) => `฿${(v / 1000).toFixed(0)}k`

export default function SalesChart({
  data,
  branches,
}: {
  data: Record<string, number | string>[]
  branches: Branch[]
}) {
  if (!branches.length) return null
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <defs>
          {branches.map((b) => (
            <linearGradient key={b.id} id={`g-${b.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={b.color_hex} stopOpacity={0.15} />
              <stop offset="95%" stopColor={b.color_hex} stopOpacity={0}    />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, name) => [`฿${(Number(v) / 1000).toFixed(1)}k`, name]}
          contentStyle={{ borderRadius: '10px', border: '1px solid #f3f4f6', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        />
        {branches.map((b) => (
          <Area
            key={b.id}
            type="monotone"
            dataKey={b.id}
            name={b.name.split(' ')[0]}
            stroke={b.color_hex}
            strokeWidth={2}
            fill={`url(#g-${b.id})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
