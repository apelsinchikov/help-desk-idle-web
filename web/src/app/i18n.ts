// Строки RU/EN из того же Localizable.xcstrings, что и в iOS. Здесь только чистые функции;
// реактивность даёт getter языка (в UI — чтение signal).
import type { AppLanguage } from '../core/format.ts'

export type StringTables = Record<AppLanguage, Record<string, string>>

type XcUnit = { stringUnit?: { value?: string } }
type XcFile = { strings?: Record<string, { localizations?: Partial<Record<string, XcUnit>> }> }

export function parseXcstrings(json: unknown): StringTables {
  const tables: StringTables = { ru: {}, en: {} }
  const strings = (json as XcFile).strings ?? {}
  for (const [key, entry] of Object.entries(strings)) {
    for (const lang of ['ru', 'en'] as const) {
      const value = entry.localizations?.[lang]?.stringUnit?.value
      if (typeof value === 'string') tables[lang][key] = value
    }
  }
  return tables
}

/** printf-подстановки Apple: %@, %lld, %d, позиционные %1$@ / %2$lld, %%. */
export function formatString(template: string, args: readonly (string | number)[]): string {
  let next = 0
  return template.replace(/%(?:(\d+)\$)?(@|lld|ld|d|%)/g, (_, pos: string | undefined, spec: string) => {
    if (spec === '%') return '%'
    const index = pos !== undefined ? Number(pos) - 1 : next++
    return String(args[index] ?? '')
  })
}

export function createI18n(tables: StringTables, language: () => AppLanguage) {
  return (key: string, ...args: (string | number)[]): string => {
    const lang = language()
    const other: AppLanguage = lang === 'ru' ? 'en' : 'ru'
    const template = tables[lang][key] ?? tables[other][key] ?? key
    return args.length > 0 ? formatString(template, args) : template.replace(/%%/g, '%')
  }
}

/** `ru*` → RU, всё остальное → EN. */
export function detectLanguage(code: string | undefined): AppLanguage {
  return code?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}
