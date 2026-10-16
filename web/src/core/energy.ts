// Энергетики за рекламу: банка = +5 минут ускорения «+30% к скорости работ». Ускорение одно, складывается время;
// банок 5 (максимум 25 минут). Полных банок столько, сколько пятиминуток осталось (начатая считается полной).
import type { GameContent } from './content.ts'
import type { GameState } from './state.ts'

export function energyCans(content: GameContent, state: GameState, at: number): { filled: number; remaining: number; canDrink: boolean } {
  const { perkId, minutesPerCan, cans } = content.config.energy
  const until = Math.max(0, ...state.perks.active.filter((a) => a.id === perkId).map((a) => a.until))
  const remaining = Math.max(0, (until - at) / 1000)
  const filled = Math.max(0, Math.min(cans, Math.ceil(remaining / (minutesPerCan * 60) - 1e-9)))
  return { filled, remaining, canDrink: filled < cans }
}
