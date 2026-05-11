import { cookies } from 'next/headers'
import { LANG_COOKIE, DEFAULT_LANG, type Lang } from './index'

export async function getServerLang(): Promise<Lang> {
  try {
    const jar = await cookies()
    const val = jar.get(LANG_COOKIE)?.value
    return val === 'en' ? 'en' : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}
