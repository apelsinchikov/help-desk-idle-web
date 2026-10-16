import { t } from '../app/strings.ts'
import type { PerkDefinition, PerkKind } from '../core/content.ts'
import { money, useGame } from './context.ts'
import { perkIcon, perkLabel } from './labels.ts'
import { SectionHint } from './SectionHint.tsx'

const ORDER: PerkKind[] = ['rewind', 'speed', 'salary', 'levelDiscount']

/** Рюкзак: перки по типам, «Включить»; у перемотки — сколько она даст. */
export function Backpack() {
  const game = useGame()
  const { engine } = game
  const inv = engine.state.perks.inventory
  const owned = engine.content.perks.filter((p) => (inv[p.id] ?? 0) > 0)
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--backpack">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.backpack')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
      </div>
      <div class="sheet__body">
        {owned.length === 0 && <p class="backpack__empty">{t('backpack.empty')}</p>}
        {ORDER.map((kind) => {
          const list = owned.filter((p) => p.kind === kind)
          if (list.length === 0) return null
          return (
            <div class="group" key={kind}>
              <div class="group__title">{t(`backpack.kind.${kind}`)}</div>
              {list.map((p) => <PerkRow key={p.id} perk={p} count={inv[p.id]} />)}
            </div>
          )
        })}
      </div>
      <SectionHint section="backpack" />
    </div>
  )
}

function PerkRow({ perk, count }: { perk: PerkDefinition; count: number }) {
  const game = useGame()
  const rewind = perk.kind === 'rewind'
  return (
    <div class="perk">
      <span class="perk__icon" aria-hidden="true">{perkIcon[perk.kind]}</span>
      <div class="perk__info">
        <div class="perk__name">{perkLabel(perk)}</div>
        <div class="perk__meta">
          {rewind ? t('backpack.rewindGain', money(game.engine.rewindPreview(perk.minutes))) : t('backpack.duration', perk.minutes)}
          {count > 1 && ` · ×${count}`}
        </div>
      </div>
      <button class="perk__use" onClick={() => game.activatePerk(perk.id)}>
        {t(rewind ? 'backpack.rewind' : 'backpack.use')}
      </button>
    </div>
  )
}
