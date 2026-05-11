import LanguageProvider from '@/components/i18n/LanguageProvider'
import { getServerLang } from '@/lib/i18n/server'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const initialLang = await getServerLang()
  return <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>
}
