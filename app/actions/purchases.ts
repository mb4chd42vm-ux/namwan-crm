'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addPurchase(formData: FormData) {
  const customer_id    = formData.get('customer_id')    as string
  const branch_id      = formData.get('branch_id')      as string
  const total_amount   = Number(formData.get('total_amount'))
  const drink_quantity = Number(formData.get('drink_quantity') ?? 0)
  const staff_note     = (formData.get('staff_note') as string).trim() || null

  if (!customer_id || !branch_id) throw new Error('Missing required fields')
  if (!total_amount || total_amount <= 0) throw new Error('Please enter a valid amount')
  if (drink_quantity < 0) throw new Error('Drink quantity cannot be negative')

  const supabase = await createClient()

  // log_purchase handles: insert purchase + items, earn points tx, update customer aggregates
  const { error } = await supabase.rpc('log_purchase', {
    p_customer_id:    customer_id,
    p_branch_id:      branch_id,
    p_items:          [{ name: 'Purchase', quantity: 1, unit_price: total_amount }],
    p_drink_quantity: drink_quantity,
    p_staff_note:     staff_note,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/purchases')
  revalidatePath('/points')
  revalidatePath('/customers')
  revalidatePath(`/customers/${customer_id}`)
  revalidatePath('/dashboard')
}
