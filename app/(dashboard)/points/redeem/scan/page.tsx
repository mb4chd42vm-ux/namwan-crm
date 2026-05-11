import Topbar from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'
import ScannerClient from './ScannerClient'

export default async function RedeemScanPage() {
  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Scan Redeem QR"
        subtitle="Scan the customer's QR to confirm their free drink"
        branches={branches ?? []}
        activeBranch={null}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-2xl border border-cream-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[13px] font-semibold text-cocoa-900 mb-2">How to confirm a redemption</p>
            <ol className="space-y-1.5 text-[12px] text-cocoa-500 list-decimal list-inside leading-relaxed">
              <li>Customer taps "Redeem" in the LINE member app and shows you a QR code</li>
              <li>Scan the QR with the camera below (or enter the token manually)</li>
              <li>Verify the customer's name and points balance on the next screen</li>
              <li>Select the branch and confirm — points are deducted at this step</li>
            </ol>
          </div>

          <ScannerClient />
        </div>
      </main>
    </div>
  )
}
