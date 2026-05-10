import Topbar from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'
import ConfirmClient from './ConfirmClient'

export default async function RedeemConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch token data server-side (admin client used in the API route)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenData: any = { valid: false, reason: 'Failed to load request' }

  try {
    const res = await fetch(`${baseUrl}/api/redeem/${token}`, { cache: 'no-store' })
    tokenData = await res.json()
  } catch {
    // tokenData stays as error state
  }

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
