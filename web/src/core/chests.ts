// Сундуки магазина: что выпадет. Случайность — с зерном сейва (как у трека), повторов вещей нет.
import type { ChestDefinition, GameContent } from './content.ts'
import { random } from './rng.ts'
import type { GameState } from './state.ts'
import { randomPerk } from './track.ts'

export type ChestReward = { items: string[]; perks: string[] }

/**
 * Бросок сундука: вещь — по шансам редкостей (одна, случайная из ещё не полученных этой редкости; если таких нет —
 * лишний перк), перки — от `perks[0]` до `perks[1]` штук уровня `perkTier` трека. Состояние меняется только зерном.
 */
export function rollChest(content: GameContent, state: GameState, chest: ChestDefinition): ChestReward {
  const reward: ChestReward = { items: [], perks: [] }
  const tiers = content.config.track.tiers
  const tier = tiers[Math.min(tiers.length - 1, Math.max(0, chest.perkTier - 1))]
  let roll = random(state)
  let extraPerk = false
  for (const odd of chest.items) {
    if (roll < odd.chance) {
      const pool = content.items.filter((i) => i.rarity === odd.rarity && !state.items.owned.includes(i.id))
      if (pool.length > 0) reward.items.push(pool[Math.min(pool.length - 1, Math.floor(random(state) * pool.length))].id)
      else extraPerk = true
      break
    }
    roll -= odd.chance
  }
  const [min, max] = chest.perks
  const count = min + Math.floor(random(state) * (max - min + 1)) + (extraPerk ? 1 : 0)
  for (let i = 0; i < count; i++) reward.perks.push(randomPerk(content, state, tier))
  return reward
}
