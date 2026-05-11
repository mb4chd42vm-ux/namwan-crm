import Topbar from '@/components/layout/Topbar'
import { createClient } from '@/lib/supabase/server'
import ScannerClient from './ScannerClient'
import { getDictionary } from '@/lib/i18n'
import { getServerLang } from '@/lib/i18n/server'

export default async function RedeemScanPage() {
  const lang = await getServerLang()
  const t    = getDictionary(lang)

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, color_hex')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title={t.redeem.title}
        subtitle={t.redeem.subtitle}
        branches={branches ?? []}
        activeBranch={null}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-lg space-y-6">
          <div className="rounded-2xl border border-cream-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[13px] font-semibold text-cocoa-900 mb-2">{t.redeem.howTo.title}</p>
            <ol className="space-y-1.5 text-[12px] text-cocoa-500 list-decimal list-inside leading-relaxed">
              <li>{t.redeem.howTo.step1}</li>
              <li>{t.redeem.howTo.step2}</li>
              <li>{t.redeem.howTo.step3}</li>
              <li>{t.redeem.howTo.step4}</li>
            </ol>
          </div>

          <ScannerClient />
        </div>
      </main>
    </div>
  )
}
