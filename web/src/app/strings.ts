// Таблицы строк из Localizable.xcstrings (общий с iOS) и функция t(), следящая за языком игры.
import { signal } from '@preact/signals'
import raw from '../../../HelpDeskIdle/HelpDeskIdle/Localization/Localizable.xcstrings?raw'
import type { AppLanguage } from '../core/format.ts'
import { createI18n, parseXcstrings } from './i18n.ts'

export const tables = parseXcstrings(JSON.parse(raw))

/** Текущий язык интерфейса. Store меняет его вместе с настройками сейва. */
export const uiLanguage = signal<AppLanguage>('ru')

export const t = createI18n(tables, () => uiLanguage.value)
