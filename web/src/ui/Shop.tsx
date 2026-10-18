import { t, uiLanguage } from '../app/strings.ts'
import type { ChestDefinition } from '../core/content.ts'
import { useGame } from './context.ts'
import { perkIcon, perkLabel } from './labels.ts'
import { coins } from './Reorg.tsx'

const CHEST_EMOJI: Record<string, string> = { hr_gift: '🎁', corporate_party: '🎉', funding_round: '💼', ipo: '🚀' }

/** Магазин: сундуки с содержимым и шансами. «Подарок от HR» — за TechCoin; за печеньки — позже (Coming soon). */
export function Shop() {
  const game = useGame()
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--shop">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('nav.shop')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
      </div>
      <div class="sheet__body">
        {game.engine.content.chests.map((chest) => <ChestCard key={chest.id} chest={chest} />)}
      </div>
    </div>
  )
}

function ChestCard({ chest }: { chest: ChestDefinition }) {
  const game = useGame()
  const { engine } = game
  const percent = (v: number) => `${(v * 100).toLocaleString(uiLanguage.value === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 1 })}%`
  const [min, max] = chest.perks
  return (
    <div class="chest">
      <div class="chest__head">
        <span class="chest__icon" aria-hidden="true">{CHEST_EMOJI[chest.id] ?? '🎁'}</span>
        <div class="chest__info">
          <div class="chest__name">{t(`chest.${chest.id}.name`)}</div>
          <div class="chest__price">{t(chest.currency === 'techcoin' ? 'chest.forCoins' : 'chest.forCookies')}</div>
        </div>
      </div>
      <ul class="chest__odds">
        {chest.items.map((odd) => (
          <li key={odd.rarity}>
            {t('chest.item', percent(odd.chance))} <span class={`rarity-text--${odd.rarity}`}>{t(`rarity.${odd.rarity}`)}</span>
          </li>
        ))}
        <li>{min === max ? t('chest.perksOne', min) : t('chest.perksRange', min, max)}</li>
      </ul>
      {chest.currency === 'techcoin' && chest.price !== undefined ? (
        engine.state.ui.sections.includes('reorg') ? (
          <button class={`chest__buy chest__buy--coins ${engine.canOpenChest(chest.id) ? '' : 'chest__buy--off'}`}
            disabled={!engine.canOpenChest(chest.id)} onClick={() => game.openChest(chest.id)}>
            {t('chest.buyCoins', coins(chest.price))} · {t('chest.have', coins(engine.state.coins.balance))}
          </button>
        ) : (
          <button class="chest__buy" disabled>{t('coins.afterReorg')}</button>
        )
      ) : (
        <button class="chest__buy" disabled>{t('common.soon')}</button>
      )}
    </div>
  )
}

/** Что выпало из сундука. */
export function ChestReport() {
  const game = useGame()
  const reward = game.chestReward.value
  if (!reward) return null
  const { engine } = game
  const close = () => (game.chestReward.value = null)
  return (
    <div class="overlay" onClick={close}>
      <div class="rewind" onClick={(e) => e.stopPropagation()}>
        <div class="rewind__icon" aria-hidden="true">🎁</div>
        <div class="rewind__title">{t('chest.result.title')}</div>
        <ul class="chest__got">
          {reward.items.map((id) => {
            const item = engine.content.item(id)!
            return <li key={id}>👕 <b>{t(`item.${id}.name`)}</b> · <span class={`rarity-text--${item.rarity}`}>{t(`rarity.${item.rarity}`)}</span></li>
          })}
          {reward.perks.map((id, i) => {
            const perk = engine.content.perk(id)!
            return <li key={`${id}-${i}`}>{perkIcon[perk.kind]} {perkLabel(perk)}</li>
          })}
        </ul>
        <p class="rewind__note">{t(reward.items.length > 0 ? 'chest.result.whereItem' : 'chest.result.where')}</p>
        <button class="rewind__ok rewind__ok--reorg" onClick={close}>{t('common.gotIt')}</button>
      </div>
    </div>
  )
}
