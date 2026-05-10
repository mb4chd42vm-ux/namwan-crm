import Topbar from '@/components/layout/Topbar'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ConfirmClient from './ConfirmClient'

// Query redeem_requests directly — avoids the HTTP-to-self anti-pattern
// that fails on Vercel when NEXT_PUBLIC_BASE_URL is not set.
async function getTokenData(token: string) {
  const db = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Expire stale tokens first
  try { await db.rpc('expire_stale_redeem_requests') } catch { /* non-fatal */ }

  const { data: request, error } = await db
    .from('redeem_requests')
    .select(`
      id, token, status, expires_at, reward_name, points_required,
      customers ( id, name, total_points, phone )
    `)
    .eq('token', token)
    .single()

  if (error || !request) {
    return { valid: false, reason: 'Redeem QR not found or expired' }
  }

  if (request.status === 'completed') {
    return { valid: false, reason: 'This QR has already been used' }
  }
  if (request.status === 'expired') {
    return { valid: false, reason: 'QR code has expired — ask customer to generate a new one' }
  }
  if (request.status === 'cancelled') {
    return { valid: false, reason: 'This redemption request was cancelled' }
  }

  const customer = request.customers as unknown as {
    id: string; name: string; total_points: number; phone: string
  } | null

  if (!customer) {
    return { valid: false, reason: 'Customer account not found' }
  }

  return {
    valid:           true,
    request_id:      request.id,
    reward_name:     request.reward_name   ?? '1 Free Drink',
    points_required: request.points_required ?? 10,
    expires_at:      request.expires_at,
    customer: {
      id:           customer.id,
      name:         customer.name,
      phone:        customer.phone,
      total_points: customer.total_points,
    },
  }
}

export default async function RedeemConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = await createServerClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  const tokenData = await getTokenData(token).catch(() => ({
    valid:  false,
    reason: 'Failed to validate QR — please try again',
  }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Confirm Redemption"
        subtitle="Verify customer and confirm free drink"
        branches={branches ?? []}
        activeBranch={null}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-lg">
          <ConfirmClient
            token={token}
            tokenData={tokenData}
            branches={branches ?? []}
          />
        </div>
      </main>
    </div>
  )
}
