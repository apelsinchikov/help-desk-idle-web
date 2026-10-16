// Сообщения внизу экрана: тосты (повышения, награды) и заявки в техподдержку из банка строк.
import type { AchievementText } from './achievements.ts'
import type { GameState } from './state.ts'

export type Message = { kind: 'toast'; text: AchievementText } | { kind: 'ticket'; index: number }

/** Пора ли показать заявку: место свободно, игрок на экране работ, обучение пройдено, с прошлого сообщения ≥ everySeconds. */
export function ticketDue(o: {
  now: number
  lastShownAt: number
  everySeconds: number
  queueEmpty: boolean
  onJobs: boolean
  tutorialDone: boolean
}): boolean {
  return o.queueEmpty && o.onJobs && o.tutorialDone && o.now - o.lastShownAt >= o.everySeconds * 1000
}

/** Номер следующей заявки (банк проходится целиком без повторов, курсор — в сейве). */
export function nextTicket(state: GameState, total: number): number {
  const index = state.ui.ticketCursor % total
  state.ui.ticketCursor++
  return index
}
