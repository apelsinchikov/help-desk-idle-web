// Бонусы вещей и перков. Внутри стата всё складывается; скидки ограничены потолками из config.effects.
import type { GameContent, StatKey } from './content.ts'
import type { GameState } from './state.ts'

export type Stats = Record<StatKey, number>

const zero = (): Stats => ({ speed: 0, salary: 0, levelDiscount: 0, gradeDiscount: 0 })

/** Только надетые вещи (для плашки эффектов и гардероба). */
export function itemTotals(content: GameContent, state: GameState): Stats {
  const total = zero()
  for (const id of Object.values(state.items.equipped)) {
    const item = id ? content.item(id) : undefined
    if (item) total[item.stat] += item.value
  }
  return total
}

/** Вещи + перки, действующие в момент `at` (перк с `until ≤ at` уже не действует); скидки обрезаны потолками. */
export function statTotals(content: GameContent, state: GameState, at: number): Stats {
  const total = itemTotals(content, state)
  for (const a of state.perks.active) {
    if (a.until <= at) continue
    const perk = content.perk(a.id)
    if (perk && perk.kind !== 'rewind') total[perk.kind] += perk.value
  }
  total.levelDiscount = Math.min(total.levelDiscount, content.config.effects.levelDiscountCap)
  total.gradeDiscount = Math.min(total.gradeDiscount, content.config.effects.gradeDiscountCap)
  return total
}
