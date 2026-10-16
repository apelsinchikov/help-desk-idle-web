// Детерминированная случайность для наград: mulberry32, зерно — в сейве (state.rngSeed) и сдвигается при каждом броске.
import type { GameState } from './state.ts'

/** Число в [0, 1). */
export function random(state: GameState): number {
  const a = (state.rngSeed + 0x6d2b79f5) >>> 0
  state.rngSeed = a
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Случайный элемент массива. */
export function pick<T>(state: GameState, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(random(state) * list.length))]
}
