import { t } from '../app/strings.ts'
import type { UpgradeDefinition } from '../core/content.ts'
import { money, useGame } from './context.ts'
import { SectionHint } from './SectionHint.tsx'

export function Upgrades() {
  const game = useGame()
  const { engine } = game
  const owned = engine.state.upgrades
  const list = [...engine.content.upgrades].sort((a, b) => Number(owned.includes(a.id)) - Number(owned.includes(b.id)))
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--upgrades">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.upgrades')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="tabs">
          <span class="tabs__active tabs__active--upgrades">{t('managers.tab.cash')}</span>
          <span class="tabs__off">{t('managers.tab.coins')} · {t('common.soon')}</span>
        </div>
      </div>
      <div class="sheet__body">
        <div class="managers__balance">
          <span>{t('managers.balance')}</span>
          <span>{money(engine.state.money)}</span>
        </div>
        {list.filter((u) => !owned.includes(u.id)).map((u) => <UpgradeRow key={u.id} up={u} />)}
        {owned.length > 0 && <div class="group__title">{t('upgrades.bought')}</div>}
        {list.filter((u) => owned.includes(u.id)).map((u) => <UpgradeRow key={u.id} up={u} />)}
      </div>
      <SectionHint section="upgrades" />
    </div>
  )
}

function UpgradeRow({ up }: { up: UpgradeDefinition }) {
  const game = useGame()
  const { engine } = game
  const bought = engine.state.upgrades.includes(up.id)
  const can = engine.canBuyUpgrade(up.id)
  const effect = up.jobId === null
    ? t('upgrades.effect.all', up.value)
    : t('upgrades.effect.job', t(`job.${up.jobId}.title`), up.value)
  return (
    <div class={`manager ${bought ? 'manager--done' : ''}`}>
      <div class="manager__info">
        <div class="manager__name">{t(`upgrade.${up.id}.name`)}</div>
        <div class="manager__runs">{effect}</div>
        {!bought && <div class="manager__cost">{money(up.cost)}</div>}
      </div>
      {bought ? (
        <span class="manager__working">{t('upgrades.bought')}</span>
      ) : (
        <button class={`manager__hire manager__hire--upgrades ${can ? '' : 'manager__hire--off'}`} disabled={!can} onClick={() => game.buyUpgrade(up.id)}>
          {t('upgrades.buy')}
        </button>
      )}
    </div>
  )
}
