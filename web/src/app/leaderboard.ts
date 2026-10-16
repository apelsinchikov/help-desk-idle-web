// Рейтинг: ответ облака запоминается на 5 минут — повторное открытие экрана раньше не делает запросов.

export type LeaderRow = { place: number; name: string; earned: number; me: boolean }
export type Leaderboard = { top: LeaderRow[]; me: LeaderRow | null; refreshedAt: number }

const TTL_MS = 5 * 60_000

export function createLeaderboardCache(fetch: () => Promise<Leaderboard>, now: () => number, ttlMs = TTL_MS) {
  let cached: { at: number; value: Leaderboard } | null = null
  let inFlight: Promise<Leaderboard> | null = null
  return {
    /** Свежий кэш — сразу; иначе один запрос на всех (ошибка не запоминается). */
    get(): Promise<Leaderboard> {
      if (cached && now() - cached.at < ttlMs) return Promise.resolve(cached.value)
      inFlight ??= fetch()
        .then((value) => { cached = { at: now(), value }; return value })
        .finally(() => { inFlight = null })
      return inFlight
    },
  }
}

export type LeaderboardCache = ReturnType<typeof createLeaderboardCache>

/** Имя для рейтинга: имя и первая буква фамилии («Евгений А.»), не длиннее 32 символов; @username не показываем. */
export function displayName(user?: { first_name?: string; last_name?: string }): string {
  const first = (user?.first_name ?? '').trim()
  const last = (user?.last_name ?? '').trim()
  const name = last ? `${first} ${last[0]}.` : first
  return name.trim().slice(0, 32)
}
