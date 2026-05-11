import th from './th'
import en from './en'

export type Lang = 'th' | 'en'
export type Dict = typeof th

export const LANG_COOKIE = 'namwan_lang'
export const DEFAULT_LANG: Lang = 'th'

export function getDictionary(lang: Lang): Dict {
  return lang === 'en' ? (en as unknown as Dict) : th
}

/** Replace {{key}} placeholders in a string */
export function interp(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''))
}
