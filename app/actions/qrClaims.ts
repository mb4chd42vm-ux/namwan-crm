'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { getCurrentSession } from '@/lib/auth'

export interface ClaimResult {
  points:        number
  drinkQuantity: number
  newBalance:    number | null
  customerName:  string
}

const EXPIRES_MINUTES = 5

export async function createQRToken(formData: FormData) {
  const session = await getCurrentSession()
  if (!session) throw new Error('Not authenticated')

  const branch_id      = formData.get('branch_id')      as string
  const drink_quantity = Number(formData.get('drink_quantity') ?? 0)

  if (!branch_id)               throw new Error('Please select a branch')
  if (!drink_quantity || drink_quantity <= 0 || !Number.isInteger(drink_quantity)) {
    throw new Error('Enter a valid drink quantity')
  }

  const token     = randomBytes(24).toString('hex')  // 48-char hex, unguessable
  const points    = drink_quantity                   // 1 drink = 1 point
  const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000).toISOString()

  const supabase = await createClient()
  const { error } = await supabase.from('point_claim_qr').insert({
    token,
    branch_id,
    drink_quantity,
    points,
    status:              'pending',
    expires_at:          expiresAt,
    created_by_staff_id: session.userId,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/points/qr/create')
  return { token, expiresAt }
}

export async function claimQRToken(formData: FormData) {
  const token       = formData.get('token')       as string
  const customer_id = formData.get('customer_id') as string

  if (!token)       throw new Error('Missing token')
  if (!customer_id) throw new Error('Missing customer')

  const supabase = await createClient()

  // Read the token row
  const { data: row, error: fetchErr } = await supabase
    .from('point_claim_qr')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchErr || !row) throw new Error('QR code not found')
  if (row.status === 'claimed')   throw new Error('This QR code has already been claimed')
  if (row.status === 'cancelled') throw new Error('This QR code has been cancelled')
  if (row.status === 'expired' || new Date(row.expires_at) < new Date()) {
    // Mark expired if not already
    if (row.status !== 'expired') {
      await supabase.from('point_claim_qr').update({ status: 'expired' }).eq('id', row.id)
    }
    throw new Error('This QR code has expired')
  }

  // Atomic claim: update status → claimed
  const { error: updateErr } = await supabase
    .from('point_claim_qr')
    .update({
      status:                  'claimed',
      claimed_by_customer_id:  customer_id,
      claimed_at:              new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')  // optimistic concurrency — only update if still pending

  if (updateErr) throw new Error(updateErr.message)

  // Award points via adjust_points RPC
  const note = `QR claim: ${row.drink_quantity} drink${row.drink_quantity !== 1 ? 's' : ''} (${row.points} pts)`
  const { error: rpcErr } = await supabase.rpc('adjust_points', {
    p_customer_id:  customer_id,
    p_branch_id:    row.branch_id,
    p_type:         'earn',
    p_points:       row.points,
    p_note:         note,
    p_performed_by: null,
  })

  if (rpcErr) {
    // Roll back status update on RPC failure
    await supabase.from('point_claim_qr').update({
      status:                 'pending',
      claimed_by_customer_id: null,
      claimed_at:             null,
    }).eq('id', row.id)
    throw new Error(rpcErr.message)
  }

  revalidatePath('/points')
  revalidatePath(`/customers/${customer_id}`)
  revalidatePath('/dashboard')

  // Fetch refreshed balance for success screen
  const { data: updatedCustomer } = await supabase
    .from('customers')
    .select('total_points')
    .eq('id', customer_id)
    .single()

  return {
    points:        row.points,
    drinkQuantity: row.drink_quantity,
    newBalance:    updatedCustomer?.total_points ?? null,
    customerName:  '',  // customer_id path: name not needed on success screen
  }
}

/**
 * Server-only: look up a customer by phone number, validate the QR token,
 * then perform the claim atomically.
 *
 * The browser never receives any customer list or IDs. Phone lookup and
 * customer_id resolution happen entirely on the server.
 */
export async function lookupAndClaimByPhone(formData: FormData): Promise<ClaimResult> {
  const token = (formData.get('token') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!token) throw new Error('Missing token')
  if (!phone || phone.length < 8) throw new Error('Enter your registered phone number')

  const supabase = await createClient()

  // 1. Validate token is still claimable (re-checks on server — not client state)
  const { data: row, error: fetchErr } = await supabase
    .from('point_claim_qr')
    .select('id, status, expires_at, branch_id, drink_quantity, points')
    .eq('token', token)
    .single()

  if (fetchErr || !row) throw new Error('QR code not found')
  if (row.status === 'claimed')   throw new Error('This QR code has already been claimed')
  if (row.status === 'cancelled') throw new Error('This QR code has been cancelled')
  if (row.status === 'expired' || new Date(row.expires_at) < new Date()) {
    if (row.status !== 'expired') {
      await supabase.from('point_claim_qr').update({ status: 'expired' }).eq('id', row.id)
    }
    throw new Error('This QR code has expired')
  }

  // 2. Look up customer by phone — server-side only, never sent to browser
  //    Try exact match first, then substring match for formatting variants
  //    (e.g. "0812345678" vs "081-234-5678")
  let customerId: string
  let customerName: string

  const { data: exact } = await supabase
    .from('customers')
    .select('id, name')
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle()

  if (exact) {
    customerId   = exact.id
    customerName = exact.name
  } else {
    // Substring match for phone formatting variants
    const { data: fuzzy } = await supabase
      .from('customers')
      .select('id, name')
      .ilike('phone', `%${phone}%`)
      .eq('is_active', true)
      .limit(1)

    if (!fuzzy || fuzzy.length === 0) {
      throw new Error('Phone number not found. Ask staff if you are registered.')
    }
    customerId   = fuzzy[0].id
    customerName = fuzzy[0].name
  }

  // 3. Atomic claim: mark token as claimed
  const { error: updateErr } = await supabase
    .from('point_claim_qr')
    .update({
      status:                 'claimed',
      claimed_by_customer_id: customerId,
      claimed_at:             new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'pending')  // optimistic concurrency — only update if still pending

  if (updateErr) throw new Error(updateErr.message)

  // 4. Award points
  const note = `QR claim: ${row.drink_quantity} drink${row.drink_quantity !== 1 ? 's' : ''} (${row.points} pts)`
  const { error: rpcErr } = await supabase.rpc('adjust_points', {
    p_customer_id:  customerId,
    p_branch_id:    row.branch_id,
    p_type:         'earn',
    p_points:       row.points,
    p_note:         note,
    p_performed_by: null,
  })

  if (rpcErr) {
    // Roll back the status update on RPC failure
    await supabase.from('point_claim_qr').update({
      status:                 'pending',
      claimed_by_customer_id: null,
      claimed_at:             null,
    }).eq('id', row.id)
    throw new Error(rpcErr.message)
  }

  revalidatePath('/points')
  revalidatePath(`/customers/${customerId}`)
  revalidatePath('/dashboard')

  // 5. Return result — only the customer's own data, not any list
  const { data: updated } = await supabase
    .from('customers')
    .select('total_points')
    .eq('id', customerId)
    .single()

  return {
    points:        row.points,
    drinkQuantity: row.drink_quantity,
    newBalance:    updated?.total_points ?? null,
    customerName,
  }
}
