import { QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import QRCreateForm from './QRCreateForm'

export default async function QRCreatePage() {
  const session = await getCurrentSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  const hdrs    = await headers()
  const host    = hdrs.get('host') ?? 'localhost:3000'
  const proto   = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  const defaultBranchId = session.profile?.branch_id ?? null

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
          <QrCode size={15} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Generate Claim QR</h1>
          <p className="text-[10px] text-gray-400">One-time QR · 5-minute expiry</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 pb-safe">
        <QRCreateForm
          branches={branches ?? []}
          defaultBranchId={defaultBranchId}
          baseUrl={baseUrl}
        />
      </main>
    </div>
  )
}
