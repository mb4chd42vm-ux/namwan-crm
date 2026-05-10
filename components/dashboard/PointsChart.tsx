'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export interface PointsBarData {
  name: string
  earned: number
  redeemed: number
  color: string
}

export default function PointsChart({ data = [] }: { data?: PointsBarData[] }) {
  if (!data?.length) return null

  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} barSize={14} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', fontSize: '10px' }}
          formatter={(v, name) => [v, name === 'earned' ? 'Earned' : 'Redeemed']}
        />
        <Bar dataKey="earned" name="earned" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
        </Bar>
        <Bar dataKey="redeemed" name="redeemed" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.color} opacity={0.35} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
