'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const POINTS_PER_DRINK = 10

export async function redeemPoints(formData: FormData) {
  const customer_id   = formData.get('customer_id')  as string
  const branch_id     = formData.get('branch_id')    as string
  const free_drinks   = Number(formData.get('free_drinks') ?? 0)
  const note          = (formData.get('note') as string).trim() || null

  if (!customer_id || !branch_id) throw new Error('Missing required fields')
  if (!free_drinks || free_drinks <= 0 || !Number.isInteger(free_drinks)) {
    throw new Error('Enter a valid number of free drinks')
  }

  const points = free_drinks * POINTS_PER_DRINK

  const supabase = await createClient()

  // Verify balance server-side before calling RPC
  const { data: customer, error: fetchErr } = await supabase
    .from('customers')
    .select('total_points')
    .eq('id', customer_id)
    .single()

  if (fetchErr || !customer) throw new Error('Customer not found')
  if ((customer.total_points ?? 0) < points) {
    throw new Error(`Insufficient balance — need ${points} pts for ${free_drinks} drink${free_drinks !== 1 ? 's' : ''}, only ${customer.total_points ?? 0} pts available`)
  }

  const redemptionNote = note || `Redeemed ${free_drinks} free drink${free_drinks !== 1 ? 's' : ''} (${points} pts)`

  // adjust_points handles: atomic balance deduction + ledger insert + overdraft guard
  const { error } = await supabase.rpc('adjust_points', {
    p_customer_id:  customer_id,
    p_branch_id:    branch_id,
    p_type:         'redeem',
    p_points:       points,   // positive — RPC applies negative sign
    p_note:         redemptionNote,
    p_performed_by: null,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/customers/${customer_id}`)
  revalidatePath('/customers')
  revalidatePath('/points')
  revalidatePath('/dashboard')
}
