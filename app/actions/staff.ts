'use server'

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSession, canManageStaff } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/** Service-role admin client — exposes auth.admin.* */
function createAdminClient() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function assertAdmin() {
  const session = await getCurrentSession()
  if (!session || !session.profile || !canManageStaff(session.profile.role)) {
    throw new Error('Forbidden — admin access required')
  }
  return session
}

// ── createStaff ─────────────────────────────────────────────────────────────

export async function createStaff(formData: FormData) {
  await assertAdmin()

  const name      = (formData.get('name')      as string).trim()
  const email     = (formData.get('email')     as string).trim().toLowerCase()
  const password  = (formData.get('password')  as string)
  const role      = (formData.get('role')      as string) || 'staff'
  const branch_id = (formData.get('branch_id') as string) || null

  if (!name)     throw new Error('Name is required')
  if (!email)    throw new Error('Email is required')
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters')
  if (!['admin', 'manager', 'staff'].includes(role)) throw new Error('Invalid role')

  const admin = createAdminClient()

  // 1. Create the auth user (email_confirm bypasses verification email)
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authErr || !authData.user) {
    const msg = authErr?.message ?? 'Failed to create auth user'
    // Friendly message for the most common errors
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      throw new Error('An account with this email already exists')
    }
    throw new Error(msg)
  }

  const authUserId = authData.user.id

  // 2. Insert staff profile — compensate by deleting the auth user if insert fails
  const supabase = await createClient()
  const { error: profileErr } = await supabase.from('staff_profiles').insert({
    auth_user_id: authUserId,
    name,
    email,
    role,
    branch_id: branch_id || null,
  })

  if (profileErr) {
    // Roll back: delete the auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(authUserId)
    if (profileErr.message.includes('unique') || profileErr.code === '23505') {
      throw new Error('A staff profile with this email already exists')
    }
    throw new Error(profileErr.message)
  }

  revalidatePath('/settings/staff')
}

// ── updateStaff ─────────────────────────────────────────────────────────────

export async function updateStaff(formData: FormData) {
  await assertAdmin()

  const staffId   = formData.get('staff_id')   as string
  const name      = (formData.get('name')      as string).trim()
  const role      = formData.get('role')        as string
  const branch_id = (formData.get('branch_id') as string) || null

  if (!staffId) throw new Error('Missing staff ID')
  if (!name)    throw new Error('Name is required')
  if (!['admin', 'manager', 'staff'].includes(role)) throw new Error('Invalid role')

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff_profiles')
    .update({ name, role, branch_id: branch_id || null })
    .eq('id', staffId)

  if (error) throw new Error(error.message)

  revalidatePath('/settings/staff')
}

// ── toggleActive ─────────────────────────────────────────────────────────────

export async function toggleActive(formData: FormData) {
  await assertAdmin()

  const staffId    = formData.get('staff_id')    as string
  const currentRaw = formData.get('is_active')   as string
  const newActive  = currentRaw !== 'true'        // flip

  if (!staffId) throw new Error('Missing staff ID')

  const supabase = await createClient()

  // Fetch auth_user_id before updating so we can ban/unban in Auth
  const { data: profile, error: fetchErr } = await supabase
    .from('staff_profiles')
    .select('auth_user_id')
    .eq('id', staffId)
    .single()

  if (fetchErr || !profile) throw new Error('Staff member not found')

  // Update profile
  const { error } = await supabase
    .from('staff_profiles')
    .update({ is_active: newActive })
    .eq('id', staffId)

  if (error) throw new Error(error.message)

  // Ban / unban in Supabase Auth so active=false actually blocks login
  const admin = createAdminClient()
  await admin.auth.admin.updateUserById(profile.auth_user_id, {
    ban_duration: newActive ? 'none' : '87600h',   // ~10 years = effectively permanent
  })

  revalidatePath('/settings/staff')
}

// ── deleteStaff ──────────────────────────────────────────────────────────────

export async function deleteStaff(formData: FormData) {
  const session = await assertAdmin()

  const staffId = formData.get('staff_id') as string
  if (!staffId) throw new Error('Missing staff ID')

  const supabase = await createClient()

  // Prevent self-deletion
  const { data: profile, error: fetchErr } = await supabase
    .from('staff_profiles')
    .select('auth_user_id, email')
    .eq('id', staffId)
    .single()

  if (fetchErr || !profile) throw new Error('Staff member not found')
  if (profile.auth_user_id === session.userId) {
    throw new Error('You cannot delete your own account')
  }

  // Delete auth user — CASCADE deletes the staff_profile row too
  const admin = createAdminClient()
  const { error: deleteErr } = await admin.auth.admin.deleteUser(profile.auth_user_id)
  if (deleteErr) throw new Error(deleteErr.message)

  revalidatePath('/settings/staff')
}
