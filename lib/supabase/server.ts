import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client.
 * Always uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security.
 * This is safe because this client is only ever constructed in Server
 * Components, Server Actions, and API Routes — never sent to the browser.
 *
 * Set the key in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role secret from Supabase dashboard>
 *
 * IMPORTANT: There is intentionally no fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Falling back silently would bypass RLS errors in dev but expose every table
 * to the public anon role in production — a critical data leak.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      '[Supabase] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Add it to .env.local and restart the dev server.'
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'All server-side queries require the service role key. ' +
      'Get it from: Supabase Dashboard → Project Settings → API → service_role (secret). ' +
      'Add it to .env.local and restart the dev server.'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component where cookies are read-only — safe to ignore
        }
      },
    },
  })
}
