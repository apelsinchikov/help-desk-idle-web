import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { Game } from '../app/store.ts'
import { formatDuration, formatMoney } from '../core/format.ts'
import { uiLanguage } from '../app/strings.ts'

export const GameContext = createContext<Game | null>(null)

/** Игра из контекста. Чтение `version` подписывает компонент на изменения состояния. */
export function useGame(): Game {
  const game = useContext(GameContext)
  if (!game) throw new Error('GameContext is missing')
  void game.version.value
  return game
}

export const money = (value: number) => '$ ' + formatMoney(value, uiLanguage.value)
export const duration = (seconds: number) => formatDuration(seconds, uiLanguage.value)
