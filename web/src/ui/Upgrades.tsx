import { iconUrl } from '../app/icons.ts'
import { t, uiLanguage } from '../app/strings.ts'
import type { CoinUpgradeDefinition, UpgradeDefinition } from '../core/content.ts'
import { formatMultiplier } from '../core/format.ts'
import { coinBonus, coinUpgradeOpen } from '../core/prestige.ts'
import { money, useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { coins } from './Reorg.tsx'
import { SectionHint } from './SectionHint.tsx'

/** Улучшения: вкладки «За деньги» (до реорганизации) и «За TechCoin» (навсегда; откроется с реорганизацией). */
export function Upgrades() {
  const game = useGame()
  const { engine } = game
  const coinsOpen = engine.state.ui.sections.includes('reorg')
  const tab = coinsOpen ? game.coinTab.value : 'cash'
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--upgrades">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.upgrades')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <CoinTabs active="upgrades" open={coinsOpen} />
      </div>
      <div class="sheet__body">{tab === 'cash' ? <CashUpgrades /> : <CoinUpgrades />}</div>
      <SectionHint section="upgrades" />
    </div>
  )
}

/** Вкладки «За деньги» / «За TechCoin»; пока реорганизации нет — вторая подписана, как её открыть. */
export function CoinTabs({ active, open }: { active: 'upgrades' | 'managers'; open: boolean }) {
  const game = useGame()
  const tab = open ? game.coinTab.value : 'cash'
  const cls = (k: 'cash' | 'coins') => (tab === k ? `tabs__active tabs__active--${active}` : 'tabs__off')
  return (
    <div class="tabs">
      <button class={cls('cash')} onClick={() => (game.coinTab.value = 'cash')}>{t('managers.tab.cash')}</button>
      {open
        ? <button class={cls('coins')} onClick={() => (game.coinTab.value = 'coins')}>{t('managers.tab.coins')}</button>
        : <span class="tabs__off">{t('managers.tab.coins')} · {t('coins.afterReorg')}</span>}
    </div>
  )
}

function CashUpgrades() {
  const { engine } = useGame()
  const owned = engine.state.upgrades
  const list = engine.content.upgrades
  return (
    <>
      <div class="managers__balance">
        <span>{t('managers.balance')}</span>
        <span>{money(engine.state.money)}</span>
      </div>
      {list.filter((u) => !owned.includes(u.id)).map((u) => <UpgradeRow key={u.id} up={u} />)}
      {owned.length > 0 && <div class="group__title">{t('upgrades.bought')}</div>}
      {list.filter((u) => owned.includes(u.id)).map((u) => <UpgradeRow key={u.id} up={u} />)}
    </>
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

/** Баланс TechCoin и напоминание: потраченные монеты бонус не дают. */
export function CoinBalance() {
  const { engine } = useGame()
  const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace('.', uiLanguage.value === 'ru' ? ',' : '.')
  return (
    <>
      <div class="managers__balance managers__balance--coins">
        <span><Icon src={iconUrl('techcoin')} class="coin-inline" /> TechCoin</span>
        <span>{coins(engine.state.coins.balance)}</span>
      </div>
      <p class="managers__intro">{t('coins.spendNote', pct(coinBonus(engine.content, engine.state)))}</p>
    </>
  )
}

function CoinUpgrades() {
  const { engine } = useGame()
  const { content, state } = engine
  // в каждой линейке видна только ближайшая ступень, купленные — внизу
  const visible = content.coinUpgrades.filter((u) => coinUpgradeOpen(state, u))
  const bought = content.coinUpgrades.filter((u) => state.coins.upgrades.includes(u.id))
  return (
    <>
      <CoinBalance />
      {visible.map((u) => <CoinUpgradeRow key={u.id} up={u} />)}
      {bought.length > 0 && <div class="group__title">{t('upgrades.bought')}</div>}
      {bought.map((u) => <CoinUpgradeRow key={u.id} up={u} />)}
    </>
  )
}

function CoinUpgradeRow({ up }: { up: CoinUpgradeDefinition }) {
  const game = useGame()
  const { engine } = game
  const bought = engine.state.coins.upgrades.includes(up.id)
  const can = engine.canBuyCoinUpgrade(up.id)
  return (
    <div class={`manager ${bought ? 'manager--done' : ''}`}>
      <div class="manager__info">
        <div class="manager__name">{t(`coinup.${up.id}.name`)}</div>
        <div class="manager__runs">{coinEffect(up)}</div>
        {!bought && <div class="manager__cost">{t('coins.cost', coins(up.cost))}</div>}
      </div>
      {bought ? (
        <span class="manager__working">{t('upgrades.bought')}</span>
      ) : (
        <button class={`manager__hire manager__hire--reorg ${can ? '' : 'manager__hire--off'}`} disabled={!can} onClick={() => game.buyCoinUpgrade(up.id)}>
          {t('upgrades.buy')}
        </button>
      )}
    </div>
  )
}

export function coinEffect(up: CoinUpgradeDefinition): string {
  switch (up.kind) {
    case 'offline': return t('coinup.effect.offline', up.value)
    case 'profit': return t('upgrades.effect.all', formatMultiplier(up.value, uiLanguage.value))
    case 'coinBonus': return t('coinup.effect.coinBonus', Math.round(up.value * 100))
    case 'keepManagers': return t('coinup.effect.keepManagers', up.value)
  }
}
