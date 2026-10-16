import { t } from '../app/strings.ts'
import type { OfflineReport } from '../core/state.ts'
import { duration, money, useGame } from './context.ts'

export function WelcomeBack({ report }: { report: OfflineReport }) {
  const game = useGame()
  return (
    <div class="welcome">
      <h1 class="welcome__title">{t('welcome.title')}</h1>
      <div class="welcome__away">{t('welcome.away', duration(report.elapsed))}</div>
      <div class="welcome__card">
        <div class="welcome__earned-label">{t('welcome.earned')}</div>
        <div class="welcome__earned">{money(report.earned)}</div>
        <div class="welcome__joke">{t('welcome.joke')}</div>
        {report.readyJobs > 0 && <div class="welcome__ready">{t('welcome.ready', report.readyJobs)}</div>}
      </div>
      {report.counted < report.elapsed && (
        <div class="welcome__cap">
          <div>{t('welcome.capped', duration(report.counted))}</div>
          <button class="welcome__buy" disabled>{t('welcome.buy')}</button>
        </div>
      )}
      <button class="welcome__collect" onClick={() => (game.offlineReport.value = null)}>{t('welcome.collect')}</button>
    </div>
  )
}
