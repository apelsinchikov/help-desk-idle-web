// Подписи перков и статов (общие для плашки эффектов, рюкзака и гардероба).
import { t, uiLanguage } from '../app/strings.ts'
import type { PerkDefinition, StatKey } from '../core/content.ts'

const pct = (v: number) => Math.round(v * 100)

/** «Скорость +100%», «Перемотка 10 мин». */
export function perkLabel(perk: PerkDefinition): string {
  if (perk.kind === 'rewind') return t('perk.rewind', perk.minutes)
  return statLabel(perk.kind, perk.value)
}

/** Прибавка вещи или перка: «+50%», «−3%». */
export function statValue(stat: StatKey, value: number): string {
  const sign = stat === 'levelDiscount' || stat === 'gradeDiscount' ? '−' : '+'
  return `${sign}${pct(value)}%`
}

/** Итог стата: скорость и зарплата — множитель к базе ×1 («×2,5»), скидки — «−45%». */
export function statTotal(stat: StatKey, value: number): string {
  if (stat === 'levelDiscount' || stat === 'gradeDiscount') return `−${pct(value)}%`
  return `×${(1 + value).toLocaleString(uiLanguage.value === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 })}`
}

/** «Скорость +50%», «Уровни −3%», «Грейд −5%», «Зарплата +10%». */
export function statLabel(stat: StatKey, value: number): string {
  return t(`stat.${stat}`, pct(value))
}

export const perkIcon: Record<PerkDefinition['kind'], string> = { speed: '⚡', salary: '💰', levelDiscount: '🏷️', rewind: '⏩' }
