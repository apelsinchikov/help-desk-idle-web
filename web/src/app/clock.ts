// Часы игры: часы устройства + поправка по времени сервера (Supabase). Перевод часов на телефоне
// не продлевает перки, не открывает замену задания раньше и не даёт лишнего оффлайн-дохода.
// Без облака (браузер, /dev/) — просто часы устройства.

const MAX_ROUND_TRIP_MS = 10_000

export function createClock(device: () => number = Date.now) {
  let offset = 0
  return {
    now: (): number => device() + offset,
    /** Ответ сервера `server` (мс) на запрос, ушедший в `sentAt` и вернувшийся в `receivedAt` (часы устройства). */
    sync(server: number, sentAt: number, receivedAt: number): boolean {
      if (!Number.isFinite(server) || receivedAt < sentAt || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return false
      offset = server - (sentAt + receivedAt) / 2
      return true
    },
  }
}

export type GameClock = ReturnType<typeof createClock>
