// ─── Segment types and computation ───────────────────────────────────────────
// Segments are auto-computed from live data — never stored as a static DB value.

export type Segment =
  | 'top_fans'
  | 'loyal'
  | 'high_potential'
  | 'new_member'
  | 'active'
  | 'inactive'

export const ALL_SEGMENTS: Segment[] = [
  'top_fans',
  'loyal',
  'high_potential',
  'new_member',
  'active',
  'inactive',
]

export const SEGMENT_META: Record<
  Segment,
  { label: string; color: string; bg: string; dot: string }
> = {
  top_fans: {
    label: 'Top Fan',
    color: 'text-amber-800',
    bg:    'bg-amber-50 border border-amber-200',
    dot:   'bg-amber-500',
  },
  loyal: {
    label: 'Loyal',
    color: 'text-purple-800',
    bg:    'bg-purple-50 border border-purple-200',
    dot:   'bg-purple-500',
  },
  high_potential: {
    label: 'High Potential',
    color: 'text-blue-800',
    bg:    'bg-blue-50 border border-blue-200',
    dot:   'bg-blue-500',
  },
  new_member: {
    label: 'New Member',
    color: 'text-emerald-800',
    bg:    'bg-emerald-50 border border-emerald-200',
    dot:   'bg-emerald-500',
  },
  active: {
    label: 'Active',
    color: 'text-green-700',
    bg:    'bg-green-50 border border-green-200',
    dot:   'bg-green-500',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-gray-500',
    bg:    'bg-gray-50 border border-gray-200',
    dot:   'bg-gray-400',
  },
}

// Segment bar fill colors (for charts)
export const SEGMENT_COLOR: Record<Segment, string> = {
  top_fans:       '#d97706', // amber-600
  loyal:          '#9333ea', // purple-600
  high_potential: '#2563eb', // blue-600
  new_member:     '#10b981', // emerald-500
  active:         '#22c55e', // green-500
  inactive:       '#9ca3af', // gray-400
}

/**
 * Compute a member's segment from their profile data and redeem count.
 *
 * Priority (highest wins):
 *   1. Top Fan     — redeemed 3+ times
 *   2. Loyal       — 10+ visits OR any redemption
 *   3. Inactive    — no activity for 60+ days
 *   4. High Potential — points balance 7–9 (one drink away from free)
 *   5. New Member  — joined within 14 days
 *   6. Active      — fallback (recent activity, doesn't meet above)
 */
export function computeSegment(
  customer: {
    created_at: string
    last_visit_at: string | null
    total_visits: number
    total_points: number
  },
  redeemCount: number,
): Segment {
  const now = Date.now()
  const MS_PER_DAY = 86_400_000

  // Use last_visit_at as activity proxy; fall back to created_at
  const lastActivityMs = customer.last_visit_at
    ? new Date(customer.last_visit_at).getTime()
    : new Date(customer.created_at).getTime()

  const daysSinceActivity = (now - lastActivityMs) / MS_PER_DAY
  const daysSinceJoined   = (now - new Date(customer.created_at).getTime()) / MS_PER_DAY

  if (redeemCount >= 3)                                                   return 'top_fans'
  if (customer.total_visits >= 10 || redeemCount >= 1)                   return 'loyal'
  if (daysSinceActivity >= 60)                                            return 'inactive'
  if (customer.total_points >= 7 && customer.total_points <= 9)          return 'high_potential'
  if (daysSinceJoined <= 14)                                              return 'new_member'
  return 'active'
}
