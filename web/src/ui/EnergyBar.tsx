import { useEffect } from 'preact/hooks'
import { t } from '../app/strings.ts'
import { energyCans } from '../core/energy.ts'
import { timer, useGame } from './context.ts'

/** Банка энергетика: полная — тёмная с молнией, пустая — пунктир. */
function Can({ full }: { full: boolean }) {
  return full ? (
    <svg class="can" viewBox="0 0 18 28" aria-hidden="true">
      <rect x="2" y="3" width="14" height="24" rx="4" fill="#1D1B16" />
      <rect x="4" y="0.8" width="10" height="3" rx="1.5" fill="#B8B2A6" />
      <rect x="2" y="6" width="14" height="2" fill="#7CE04A" />
      <path d="M10 10 6 16h3.5L8 22l5-7H9.5L10 10z" fill="#7CE04A" />
    </svg>
  ) : (
    <svg class="can" viewBox="0 0 18 28" aria-hidden="true">
      <rect x="2" y="3" width="14" height="24" rx="4" fill="none" stroke="#CFC6B4" stroke-width="1.5" stroke-dasharray="3 2" />
      <rect x="4" y="0.8" width="10" height="3" rx="1.5" fill="#E2DACB" />
    </svg>
  )
}

/** Энергетики: 5 банок, таймер под последней полной, кнопка «Ускорить» (реклама); банки полные — шутка в облачке. */
export function EnergyBar() {
  const game = useGame()
  const { engine } = game
  const { cans: total, minutesPerCan } = engine.content.config.energy
  const cans = energyCans(engine.content, engine.state, game.now())
  const joke = game.energyJoke.value
  useEffect(() => {
    if (joke === null) return
    const id = setTimeout(() => (game.energyJoke.value = null), 3000)
    return () => clearTimeout(id)
  }, [joke])
  // все полные: новая банка освободится, когда останется (total − 1) × 5 минут
  const nextFree = cans.remaining - (total - 1) * minutesPerCan * 60
  const busy = game.adBusy.value
  return (
    <div class="energy">
      <div class="energy__cans">
        <div class="energy__row">{Array.from({ length: total }, (_, i) => <Can key={i} full={i < cans.filled} />)}</div>
        {cans.filled > 0 && (
          <div class="energy__timer" style={{ paddingLeft: `${(cans.filled - 1) * 22}px` }}>{timer(cans.remaining)}</div>
        )}
      </div>
      <button class={`energy__button ${cans.canDrink ? '' : 'energy__button--full'}`} disabled={busy} onClick={() => void game.watchAd()}>
        {busy ? (
          <span class="energy__title">{t('energy.watching')}</span>
        ) : cans.canDrink ? (
          <>
            <span class="energy__title">⚡ {t('energy.boost')}</span>
            <span class="energy__sub">{t('energy.plus')}</span>
          </>
        ) : (
          <>
            <span class="energy__title">⚡ {t('energy.max')}</span>
            <span class="energy__sub">{t('energy.nextCan', timer(Math.max(0, nextFree)))}</span>
          </>
        )}
      </button>
      {joke !== null && <div class="energy__joke" role="status">{t(`energy.joke.${joke}`)}</div>}
    </div>
  )
}
