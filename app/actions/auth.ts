'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email    = ((formData.get('email')    as string) ?? '').trim()
  const password =  (formData.get('password') as string) ?? ''

  if (!email || !password) {
    redirect('/login?error=Email+and+password+are+required')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent('Invalid email or password'))
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
