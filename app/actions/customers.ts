'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function checkEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
    throw new Error(
      'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the dev server.'
    )
  }
}

export async function addCustomer(formData: FormData) {
  checkEnv()

  const name     = (formData.get('name')     as string).trim()
  const phone    = (formData.get('phone')    as string).trim()
  const line_id  = (formData.get('line_id')  as string).trim() || null
  // type="date" always sends YYYY-MM-DD — correct format for PostgreSQL date column
  const birthday = (formData.get('birthday') as string).trim() || null
  const notes    = (formData.get('notes')    as string).trim() || null

  if (!name)  throw new Error('Name is required')
  if (!phone) throw new Error('Phone is required')

  const supabase = await createClient()

  let result
  try {
    result = await supabase
      .from('customers')
      .insert({ name, phone, line_id, birthday, notes })
      .select('id')
      .single()
  } catch (e: unknown) {
    // Supabase JS throws TypeError: fetch failed when the URL is unreachable
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[addCustomer] fetch error:', msg)
    if (msg.toLowerCase().includes('fetch failed') ||
        msg.toLowerCase().includes('enotfound') ||
        msg.toLowerCase().includes('econnrefused')) {
      throw new Error('Cannot reach Supabase — check NEXT_PUBLIC_SUPABASE_URL in .env.local')
    }
    throw new Error(`Database error: ${msg}`)
  }

  if (result.error) {
    console.error('[addCustomer] Supabase error:', result.error)
    if (result.error.code === '23505') {
      throw new Error('A customer with this phone number already exists')
    }
    throw new Error(result.error.message)
  }

  console.log('[addCustomer] created customer id:', result.data?.id)

  revalidatePath('/customers')
  revalidatePath('/dashboard')
}
