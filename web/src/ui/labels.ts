// Подписи перков и статов (общие для плашки эффектов, рюкзака и гардероба).
import { t } from '../app/strings.ts'
import type { PerkDefinition, StatKey } from '../core/content.ts'

const pct = (v: number) => Math.round(v * 100)

/** «Скорость +100%», «Перемотка 10 мин». */
export function perkLabel(perk: PerkDefinition): string {
  if (perk.kind === 'rewind') return t('perk.rewind', perk.minutes)
  return statLabel(perk.kind, perk.value)
}

/** «Скорость +50%», «Уровни −3%», «Грейд −5%», «Зарплата +10%». */
export function statLabel(stat: StatKey, value: number): string {
  return t(`stat.${stat}`, pct(value))
}

export const perkIcon: Record<PerkDefinition['kind'], string> = { speed: '⚡', salary: '💰', levelDiscount: '🏷️', rewind: '⏩' }
