import { useState } from 'preact/hooks'
import { t } from '../app/strings.ts'
import type { PerkDefinition, PerkKind } from '../core/content.ts'
import { inventoryCount } from '../core/perks.ts'
import { useGame } from './context.ts'
import { perkIcon, statValue } from './labels.ts'
import { SectionHint } from './SectionHint.tsx'
import { Closet, useFreshItems } from './Wardrobe.tsx'

const ORDER: PerkKind[] = ['rewind', 'speed', 'salary', 'levelDiscount']

/** Рюкзак: две вкладки — перки (плитки, «Включить») и вещи (новые с меткой, надеть отсюда же). */
export function Backpack() {
  const game = useGame()
  const { engine } = game
  const perks = inventoryCount(engine.state)
  const newItems = engine.state.items.owned.filter((id) => !engine.state.items.seen.includes(id)).length
  const [tab, setTab] = useState<'perks' | 'items'>(perks > 0 || newItems === 0 ? 'perks' : 'items')
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--backpack">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.backpack')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
        <div class="tabs">
          <button class={tab === 'perks' ? 'tabs__active tabs__active--backpack' : 'tabs__off'} onClick={() => setTab('perks')}>
            {t('backpack.tab.perks', perks)}
          </button>
          <button class={tab === 'items' ? 'tabs__active tabs__active--backpack' : 'tabs__off'} onClick={() => setTab('items')}>
            {t('backpack.tab.items')}{newItems > 0 && <span class="tabs__dot" />}
          </button>
        </div>
      </div>
      <div class="sheet__body">{tab === 'perks' ? <PerkGrid /> : <ItemsTab />}</div>
      <SectionHint section="backpack" />
    </div>
  )
}

function ItemsTab() {
  const fresh = useFreshItems()
  return <Closet fresh={fresh} />
}

function PerkGrid() {
  const { engine } = useGame()
  const inv = engine.state.perks.inventory
  const owned = engine.content.perks.filter((p) => (inv[p.id] ?? 0) > 0)
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.value - b.value || a.minutes - b.minutes)
  if (owned.length === 0) return <p class="backpack__empty">{t('backpack.empty')}</p>
  return <div class="perks">{owned.map((p) => <PerkTile key={p.id} perk={p} count={inv[p.id]} />)}</div>
}

/** Плитка перка: иконка с минутами на ней, сила, количество, кнопка. */
function PerkTile({ perk, count }: { perk: PerkDefinition; count: number }) {
  const game = useGame()
  const rewind = perk.kind === 'rewind'
  return (
    <div class={`perk perk--${perk.kind}`}>
      <div class="perk__icon" aria-hidden="true">
        {rewind ? '⏱️' : perkIcon[perk.kind]}
        <span class="perk__minutes">{t('perk.minutes', perk.minutes)}</span>
      </div>
      <div class="perk__name">{perk.kind === 'rewind' ? t('backpack.kind.rewind') : `${t(`statName.${perk.kind}`)} ${statValue(perk.kind, perk.value)}`}</div>
      {count > 1 && <div class="perk__count">×{count}</div>}
      <button class="perk__use" onClick={() => game.activatePerk(perk.id)}>{t(rewind ? 'backpack.rewind' : 'backpack.use')}</button>
    </div>
  )
}
