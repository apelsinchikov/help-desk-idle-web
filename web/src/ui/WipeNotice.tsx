import { t } from '../app/strings.ts'
import { useGame } from './context.ts'

/** Окно после вайпа: новый сезон и компенсация в рюкзаке. Один раз. */
export function WipeNotice() {
  const game = useGame()
  if (!game.engine.state.ui.wiped) return null
  return (
    <div class="overlay">
      <div class="rewind">
        <div class="rewind__icon" aria-hidden="true">🧹</div>
        <div class="rewind__title">{t('wipe.title')}</div>
        <p class="rewind__note">{t('wipe.text')}</p>
        <button class="rewind__ok" onClick={() => game.ackWipe()}>{t('common.gotIt')}</button>
      </div>
    </div>
  )
}
