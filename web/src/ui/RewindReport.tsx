import { t } from '../app/strings.ts'
import { money, useGame } from './context.ts'

/** Итог перемотки: «Время перемотано на N мин — заработано $X». */
export function RewindReport() {
  const game = useGame()
  const report = game.rewindReport.value
  if (!report) return null
  return (
    <div class="overlay" onClick={() => (game.rewindReport.value = null)}>
      <div class="rewind" onClick={(e) => e.stopPropagation()}>
        <div class="rewind__icon" aria-hidden="true">⏱️</div>
        <div class="rewind__title">{t('rewind.title', report.minutes)}</div>
        <div class="rewind__earned">+{money(report.earned)}</div>
        {report.earned === 0 && <p class="rewind__note">{t('rewind.noManagers')}</p>}
        <button class="rewind__ok" onClick={() => (game.rewindReport.value = null)}>{t('common.gotIt')}</button>
      </div>
    </div>
  )
}
