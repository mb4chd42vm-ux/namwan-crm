import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Root route — smart redirect based on auth state.
 *
 * This is the PWA start_url ("/"), so it runs on every cold launch of the
 * installed app.
 *
 * - Authenticated (staff session cookie present) → /dashboard
 * - Unauthenticated                              → /login
 *
 * /member is the customer-facing LINE mini-app page and is never the default
 * landing for the installed staff PWA.
 */
export default async function Root() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
