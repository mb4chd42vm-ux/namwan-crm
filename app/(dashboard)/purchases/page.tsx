import Topbar from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'
import { ExternalLink } from 'lucide-react'

/**
 * Sales / purchase management is handled by Loyverse POS.
 * This page is intentionally hidden from the Namwan Loyalty navigation.
 * The route still exists so direct links don't 404.
 */
export default async function PurchasesPage() {
  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Sales & Purchases"
        subtitle="Managed in Loyverse POS"
        branches={branches ?? []}
        activeBranch={null}
      />
      <main className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 border border-gray-200">
          <ExternalLink size={28} className="text-gray-400" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-base font-bold text-gray-900">Sales are managed in Loyverse</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Purchase history, receipts, revenue, and product sales are handled by Loyverse POS.
            Namwan Loyalty focuses on member points, redemptions, and customer profiles.
          </p>
        </div>
      </main>
    </div>
  )
}
