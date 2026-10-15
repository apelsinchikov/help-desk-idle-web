// Какой сейв оставить, если есть и локальный, и облачный.
// Побеждает тот, где заработано больше за всё время; при равенстве — более свежий.
import type { GameState } from './state.ts'

export function pickSave(local: GameState | null, remote: GameState | null): GameState | null {
  if (!local) return remote
  if (!remote) return local
  if (remote.lifetimeEarnings !== local.lifetimeEarnings) {
    return remote.lifetimeEarnings > local.lifetimeEarnings ? remote : local
  }
  return remote.lastActiveAt > local.lastActiveAt ? remote : local
}
