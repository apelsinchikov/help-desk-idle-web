// Общее для тестов движка: управляемые часы (мс) и движок с правкой стартового состояния.
import { bundledContent } from './bundled.ts'
import { GameEngine } from './engine.ts'
import { newGame } from './state.ts'
import type { GameState } from './state.ts'

export function makeClock(start = 0) {
  const clock = { t: start, now: () => clock.t }
  return clock
}

export function makeEngine(clock: { t: number; now: () => number }, edit: (s: GameState) => void = () => {}) {
  const state = newGame(bundledContent, clock.t, 'ru')
  edit(state)
  return new GameEngine(bundledContent, state, clock.now)
}
