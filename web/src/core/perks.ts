// Рюкзак перков: выдача и список действующих. Включение и перемотка — в движке (меняют время работ).
import type { GameContent, PerkDefinition } from './content.ts'
import type { GameState } from './state.ts'

export function grantPerk(state: GameState, perkId: string, count = 1): void {
  state.perks.inventory[perkId] = (state.perks.inventory[perkId] ?? 0) + count
}

/** Сколько перков в рюкзаке всего. */
export function inventoryCount(state: GameState): number {
  return Object.values(state.perks.inventory).reduce((sum, n) => sum + n, 0)
}

/** Действующие перки и сколько им осталось (секунды), по возрастанию остатка. */
export function activeEffects(content: GameContent, state: GameState, at: number): { perk: PerkDefinition; remaining: number }[] {
  const result: { perk: PerkDefinition; remaining: number }[] = []
  for (const a of state.perks.active) {
    const perk = content.perk(a.id)
    if (perk && a.until > at) result.push({ perk, remaining: (a.until - at) / 1000 })
  }
  return result.sort((x, y) => x.remaining - y.remaining)
}
