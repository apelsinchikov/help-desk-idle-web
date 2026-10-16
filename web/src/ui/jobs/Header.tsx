import { iconUrl } from '../../app/icons.ts'
import { t } from '../../app/strings.ts'
import { nextBuyMode } from '../../core/state.ts'
import { formatMoney } from '../../core/format.ts'
import { uiLanguage } from '../../app/strings.ts'
import { money, useGame } from '../context.ts'
import { Icon } from '../Icon.tsx'

export function Header() {
  const game = useGame()
  const { engine } = game
  return (
    <header class="header">
      <button class="header__avatar-button" aria-label={t('menu.wardrobe')} onClick={() => game.navigate('wardrobe')}>
        <Icon src={iconUrl('avatar')} class="header__avatar" />
      </button>
      <div class="header__money">
        <div class="header__balance">{money(engine.state.money)}</div>
        <div class="header__income">
          {t('header.perSecond', formatMoney(engine.incomePerSecond, uiLanguage.value))}
          {engine.state.ui.tutorialDone && <span class="header__stars"> · ⭐ {engine.state.stars}</span>}
        </div>
      </div>
      <button class="header__buy" data-tutorial="buy-mode" onClick={() => (game.buyMode.value = nextBuyMode(game.buyMode.value))}>
        <span>{t('buy.label')}</span>
        <span>{t(`buy.mode.${game.buyMode.value}`)}</span>
      </button>
    </header>
  )
}
