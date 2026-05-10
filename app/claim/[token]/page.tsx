import { createClient } from '@/lib/supabase/server'
import { Star, QrCode, Clock } from 'lucide-react'
import ClaimForm from './ClaimForm'

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const supabase = await createClient()

  // Look up the QR token
  const { data: row } = await supabase
    .from('point_claim_qr')
    .select('*, branches(id, name, color_hex)')
    .eq('token', token)
    .single()

  // Determine state
  const now        = new Date()
  const isExpired  = !row || new Date(row.expires_at) < now
  const isClaimed  = row?.status === 'claimed'
  const isCancelled = row?.status === 'cancelled'
  const isInvalid  = !row

  const branch = row?.branches as { id: string; name: string; color_hex: string } | null

  if (isInvalid) {
    return <ErrorPage title="QR Code Not Found" message="This QR code doesn't exist or may have been removed." />
  }
  if (isClaimed) {
    return <ErrorPage title="Already Claimed" message="This QR code has already been used." />
  }
  if (isCancelled) {
    return <ErrorPage title="Cancelled" message="This QR code has been cancelled by staff." />
  }
  if (isExpired) {
    return <ErrorPage title="QR Code Expired" message="This QR code has expired. Ask staff to generate a new one." expired />
  }

  // Load customers for phone lookup
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('is_active', true)
    .order('name')

  const expiresAt = new Date(row.expires_at)
  const minsLeft  = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60000))

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pt-5 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
          <Star size={20} className="text-amber-600 fill-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-gray-900 leading-none">Namwan Loyalty</p>
          <p className="text-xs text-gray-400 mt-0.5">Point Claim</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1">
          <Clock size={12} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">{minsLeft} min</span>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 px-4 pb-8">
        <div className="rounded-3xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-6">
          <ClaimForm
            token={token}
            drinkQuantity={row.drink_quantity}
            points={row.points}
            branchName={branch?.name ?? 'Unknown'}
            branchColor={branch?.color_hex ?? '#c45f12'}
            customers={customers ?? []}
          />
        </div>
      </div>
    </div>
  )
}

function ErrorPage({
  title,
  message,
  expired,
}: {
  title: string
  message: string
  expired?: boolean
}) {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full ${expired ? 'bg-amber-100' : 'bg-gray-100'}`}>
        <QrCode size={36} className={expired ? 'text-amber-400' : 'text-gray-400'} />
      </div>
      <div className="space-y-2">
        <p className="text-xl font-bold text-gray-900">{title}</p>
        <p className="text-base text-gray-500 leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
