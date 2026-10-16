import { useEffect, useState } from 'preact/hooks'
import { t } from '../app/strings.ts'
import type { Leaderboard as Board, LeaderRow } from '../app/leaderboard.ts'
import { money, useGame } from './context.ts'

/** Рейтинг: топ-50 по заработанному за всё время, своя строка подсвечена; не в топе — своё место внизу. */
export function Leaderboard() {
  const game = useGame()
  const [board, setBoard] = useState<Board | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    game.leaderboard?.get().then(setBoard, () => setFailed(true))
  }, [])
  const minutes = board ? Math.max(0, Math.floor((game.now() - board.refreshedAt) / 60_000)) : 0
  const meInTop = board?.top.some((r) => r.me) ?? false
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--leaderboard">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.leaderboard')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="leaderboard__about">{t('leaderboard.about')}</div>
      </div>
      <div class="sheet__body">
        {!board && !failed && <p class="backpack__empty">{t('leaderboard.loading')}</p>}
        {failed && <p class="backpack__empty">{t('leaderboard.failed')}</p>}
        {board && board.top.length === 0 && <p class="backpack__empty">{t('leaderboard.empty')}</p>}
        {board?.top.map((r) => <Row key={r.place} row={r} />)}
        {board?.me && !meInTop && (
          <>
            <div class="leaderboard__gap">…</div>
            <Row row={board.me} />
          </>
        )}
        {board && <p class="leaderboard__updated">{t('leaderboard.updated', minutes)}</p>}
      </div>
    </div>
  )
}

function Row({ row }: { row: LeaderRow }) {
  const medal = row.place === 1 ? '🥇' : row.place === 2 ? '🥈' : row.place === 3 ? '🥉' : `${row.place}`
  return (
    <div class={`leader ${row.me ? 'leader--me' : ''}`}>
      <span class="leader__place">{medal}</span>
      <span class="leader__name">{row.name}{row.me && ` · ${t('leaderboard.you')}`}</span>
      <span class="leader__money">{money(row.earned)}</span>
    </div>
  )
}
