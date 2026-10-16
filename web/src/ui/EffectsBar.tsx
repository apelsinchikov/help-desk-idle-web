import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../app/strings.ts'
import type { StatKey } from '../core/content.ts'
import { itemTotals } from '../core/modifiers.ts'
import { activeEffects, inventoryCount } from '../core/perks.ts'
import { timer, useGame } from './context.ts'
import { perkIcon, perkLabel, statLabel } from './labels.ts'

const STATS: StatKey[] = ['speed', 'salary', 'levelDiscount', 'gradeDiscount']

/** Плашка эффектов над работами: свёрнута — сводка, тап — раскрыть на месте; закрывается тапом мимо или через 20 с. */
export function EffectsBar() {
  const game = useGame()
  const { engine } = game
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const now = game.now()
  const perks = activeEffects(engine.content, engine.state, now)
  const items = itemTotals(engine.content, engine.state)
  const itemStats = STATS.filter((s) => items[s] > 0)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const timerId = setTimeout(close, engine.content.config.messages.seconds * 1000)
    const outside = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', outside)
    return () => { clearTimeout(timerId); document.removeEventListener('pointerdown', outside) }
  }, [open])

  if (perks.length === 0 && itemStats.length === 0) return null
  const summary = perks.length > 0
    ? t('effects.summary', perks.length, timer(perks[0].remaining))
    : t('effects.itemsOnly')

  return (
    <div class={`effects ${open ? 'effects--open' : ''}`} ref={ref}>
      <button class="effects__summary" onClick={() => setOpen(!open)}>{summary}</button>
      {open && (
        <div class="effects__list">
          {perks.map(({ perk, remaining }, i) => (
            <div class="effects__row" key={`${perk.id}-${i}`}>
              <span>{perkIcon[perk.kind]} {perkLabel(perk)}</span>
              <span class="effects__time">{timer(remaining)}</span>
            </div>
          ))}
          {itemStats.length > 0 && (
            <div class="effects__row effects__row--items">
              {t('effects.items', itemStats.map((s) => statLabel(s, items[s])).join(', '))}
            </div>
          )}
          <button class="effects__backpack" onClick={() => game.navigate('backpack')}>
            {t('effects.backpack', inventoryCount(engine.state))}
          </button>
        </div>
      )}
    </div>
  )
}
