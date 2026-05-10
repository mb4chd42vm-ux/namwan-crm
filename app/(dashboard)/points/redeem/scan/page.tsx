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
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-800">How to confirm a redemption</p>
            <ol className="mt-2 space-y-1 text-xs text-amber-700 list-decimal list-inside">
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
