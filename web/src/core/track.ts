// Трек звёзд: перк каждые 5 ⭐, вещи по порядку (белая — через 10 ⭐, синяя — 20, фиолетовая — 40, оранжевая — 80),
// перемотка на 50, 100, 150…
import type { GameContent, PerkKind, TrackTier } from './content.ts'
import type { GameEngine } from './engine.ts'
import { nextItem } from './items.ts'
import { grantPerk } from './perks.ts'
import { pick, random } from './rng.ts'
import type { GameState } from './state.ts'

export type Reward = { kind: 'perk'; perkId: string } | { kind: 'item'; itemId: string }

/** Уровень перков по числу звёзд: строка с наибольшим fromStars ≤ stars. */
export function perkTier(content: GameContent, stars: number): TrackTier {
  const tiers = content.config.track.tiers
  return [...tiers].reverse().find((t) => t.fromStars <= stars) ?? tiers[0]
}

/** На каких звёздах выдаются вещи (по порядку items.json): каждая — через itemStars[редкость] после прошлой. */
export function itemStarSchedule(content: GameContent): number[] {
  let at = 0
  return content.items.map((item) => (at += content.config.track.itemStars[item.rarity]))
}

/** Выдаёт награды за звёзды (track.claimed, stars] и запоминает, что выдано. */
export function claimTrack(engine: GameEngine): Reward[] {
  const { content, state } = engine
  const { perkEvery, rewindEvery } = content.config.track
  const itemStars = new Set(itemStarSchedule(content))
  const rewards: Reward[] = []
  for (let s = state.track.claimed + 1; s <= state.stars; s++) {
    const tier = perkTier(content, s)
    if (itemStars.has(s)) {
      const item = nextItem(content, state)
      if (item) {
        engine.grantItem(item.id)
        rewards.push({ kind: 'item', itemId: item.id })
      } else {
        rewards.push(givePerk(state, randomPerk(content, state, tier)))
      }
    } else if (s % perkEvery === 0) {
      rewards.push(givePerk(state, randomPerk(content, state, tier)))
    }
    if (s % rewindEvery === 0) rewards.push(givePerk(state, `rewind_${Math.max(...tier.rewind)}`))
    state.track.claimed = s
  }
  return rewards
}

function givePerk(state: GameState, perkId: string): Reward {
  grantPerk(state, perkId)
  return { kind: 'perk', perkId }
}

/** Тип — по весам, сила и длительность — случайные из открытого уровня. */
function randomPerk(content: GameContent, state: GameState, tier: TrackTier): string {
  const weights = content.config.track.weights
  const kinds = Object.keys(weights) as PerkKind[]
  const total = kinds.reduce((sum, k) => sum + weights[k], 0)
  let roll = random(state) * total
  let kind = kinds[kinds.length - 1]
  for (const k of kinds) {
    if (roll < weights[k]) { kind = k; break }
    roll -= weights[k]
  }
  if (kind === 'rewind') return `rewind_${pick(state, tier.rewind)}`
  const value = Math.round(pick(state, tier[kind]) * 100)
  const minutes = pick(state, tier.minutes)
  const prefix = kind === 'levelDiscount' ? 'level' : kind
  return `${prefix}_${value}_${minutes}`
}
