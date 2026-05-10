'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const POINTS_PER_DRINK = 10

export async function redeemPoints(formData: FormData) {
  const customer_id = formData.get('customer_id') as string
  const branch_id   = formData.get('branch_id')   as string

  if (!customer_id || !branch_id) throw new Error('Missing required fields')

  const supabase = await createClient()

  const { data: customer, error: fetchErr } = await supabase
    .from('customers')
    .select('total_points')
    .eq('id', customer_id)
    .single()

  if (fetchErr || !customer) throw new Error('Customer not found')
  if ((customer.total_points ?? 0) < POINTS_PER_DRINK) {
    throw new Error(`Not enough points — need ${POINTS_PER_DRINK}, have ${customer.total_points ?? 0}`)
  }

  const { error } = await supabase.rpc('adjust_points', {
    p_customer_id:  customer_id,
    p_branch_id:    branch_id,
    p_type:         'redeem',
    p_points:       POINTS_PER_DRINK,
    p_note:         'Redeemed 1 free drink',
    p_performed_by: null,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/customers/${customer_id}`)
  revalidatePath('/customers')
  revalidatePath('/points')
  revalidatePath('/dashboard')
}
