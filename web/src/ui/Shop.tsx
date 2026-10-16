import { t, uiLanguage } from '../app/strings.ts'
import type { ChestDefinition } from '../core/content.ts'
import { useGame } from './context.ts'

const CHEST_EMOJI: Record<string, string> = { hr_gift: '🎁', corporate_party: '🎉', funding_round: '💼', ipo: '🚀' }

/** Магазин: сундуки с содержимым и шансами. Покупка — этапы 3–4 (Coming soon). */
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
      <button class="chest__buy" disabled>{t('common.soon')}</button>
    </div>
  )
}
