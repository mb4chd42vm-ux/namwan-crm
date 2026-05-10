import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'manager' | 'staff'

export interface StaffProfile {
  id:           string
  auth_user_id: string
  name:         string
  email:        string
  role:         Role
  branch_id:    string | null
  is_active:    boolean
}

export async function getStaffProfile(userId: string): Promise<StaffProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('staff_profiles')
    .select('id, auth_user_id, name, email, role, branch_id, is_active')
    .eq('auth_user_id', userId)
    .single()
  return data
}

export async function getCurrentSession(): Promise<{
  userId: string
  email: string
  profile: StaffProfile | null
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const profile = await getStaffProfile(user.id)
  return { userId: user.id, email: user.email ?? '', profile }
}

// ── Permission helpers ──────────────────────────────────────────────────────

/** Only admin can create / edit / deactivate staff accounts */
export function canManageStaff(role: Role): boolean {
  return role === 'admin'
}

/** Staff cannot manually adjust points (admin + manager only) */
export function canEditPointsManually(role: Role): boolean {
  return role === 'admin' || role === 'manager'
}

/** Staff cannot view or manage campaigns (admin + manager only) */
export function canManageCampaigns(role: Role): boolean {
  return role === 'admin' || role === 'manager'
}

/** Only admin can manage branch settings */
export function canManageBranches(role: Role): boolean {
  return role === 'admin'
}
