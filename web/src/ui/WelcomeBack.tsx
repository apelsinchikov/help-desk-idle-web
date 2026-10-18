import { t } from '../app/strings.ts'
import type { OfflineReport } from '../core/state.ts'
import { coinUpgradeOpen } from '../core/prestige.ts'
import { duration, money, useGame } from './context.ts'

export function WelcomeBack({ report }: { report: OfflineReport }) {
  const game = useGame()
  const { engine } = game
  const capped = report.counted < report.elapsed
  // «Ночная смена» продаётся за TechCoin: кнопка живая, если реорганизация открыта и следующая ступень ещё есть
  const nextShift = engine.content.coinUpgrades.find((u) => u.kind === 'offline' && coinUpgradeOpen(engine.state, u))
  const canShop = engine.state.ui.sections.includes('reorg') && !!nextShift
  const doubled = game.offlineDoubled.value
  return (
    <div class="welcome">
      <h1 class="welcome__title">{t('welcome.title')}</h1>
      <div class="welcome__away">{t('welcome.away', duration(report.elapsed))}</div>
      <div class="welcome__card">
        <div class="welcome__earned-label">{t('welcome.earned')}</div>
        <div class="welcome__earned">{money(report.earned * (doubled ? 2 : 1))}</div>
        <div class="welcome__joke">{t('welcome.joke')}</div>
        {report.readyJobs > 0 && <div class="welcome__ready">{t('welcome.ready', report.readyJobs)}</div>}
      </div>
      {capped && (
        <div class="welcome__cap">
          <div>{t('welcome.capped', duration(report.counted))}</div>
          <button class="welcome__buy" disabled={!canShop} onClick={() => game.openCoinUpgrades()}>{t('welcome.buy')}</button>
          {!canShop && nextShift && <small class="welcome__hint">{t('welcome.needCoins')}</small>}
        </div>
      )}
      <div class="welcome__actions">
        {game.ads && report.earned > 0 && (
          <button class="welcome__double" disabled={doubled || game.adBusy.value} onClick={() => void game.doubleOffline()}>
            {doubled ? t('welcome.doubled') : t('welcome.double')}
          </button>
        )}
        <button class="welcome__collect" onClick={() => game.closeOffline()}>{t('welcome.collect')}</button>
      </div>
    </div>
  )
}
