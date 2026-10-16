import { useEffect, useState } from 'preact/hooks'
import { iconUrl } from '../app/icons.ts'
import { t } from '../app/strings.ts'
import { RARITIES, SLOTS } from '../core/content.ts'
import type { ItemDefinition, Rarity, Slot, StatKey } from '../core/content.ts'
import { compareEquip } from '../core/items.ts'
import type { CompareRow } from '../core/items.ts'
import { itemTotals, perkTotals } from '../core/modifiers.ts'
import { activeEffects } from '../core/perks.ts'
import { Chibi } from './Chibi.tsx'
import { timer, useGame } from './context.ts'
import { Icon } from './Icon.tsx'
import { perkIcon, perkLabel, statLabel, statTotal, statValue } from './labels.ts'
import { SectionHint } from './SectionHint.tsx'

const STATS: StatKey[] = ['speed', 'salary', 'levelDiscount', 'gradeDiscount']
const SLOT_EMOJI: Record<Slot, string> = { head: '🧢', glasses: '👓', top: '🧥', pants: '👖', shoes: '👟', watch: '⌚', accessory: '🪪' }

/**
 * Вещи, новые в момент открытия экрана: метка «новое» видна весь визит, а сам экран сразу отмечает новое просмотренным
 * (`onSeen`: гардероб — вещи, рюкзак — и вещи, и перки).
 */
export function useFreshItems(onSeen: () => void): Set<string> {
  const game = useGame()
  const [fresh] = useState(() => new Set(game.engine.state.items.owned.filter((id) => !game.engine.state.items.seen.includes(id))))
  useEffect(() => { onSeen() }, [])
  return fresh
}

/** Гардероб в духе RPG: человечек со слотами вокруг, под ним — бонусы вещей и перков, ниже — шкаф. */
export function Wardrobe() {
  const game = useGame()
  const fresh = useFreshItems(() => { if (game.engine.state.items.owned.some((id) => !game.engine.state.items.seen.includes(id))) game.markItemsSeen() })
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div class="sheet">
      <div class="sheet__head sheet__head--wardrobe">
        <div class="sheet__title-row">
          <h1 class="sheet__title">{t('menu.wardrobe')}</h1>
          <button class="sheet__close" aria-label={t('common.close')} onClick={() => game.navigate('jobs')}>✕</button>
        </div>
      </div>
      <div class="sheet__body">
        <Doll onSlot={(id) => setOpen(id)} />
        <Bonuses />
        <div class="group__title">{t('wardrobe.closet')}</div>
        <Closet fresh={fresh} open={open} setOpen={setOpen} />
      </div>
      <SectionHint section="wardrobe" />
    </div>
  )
}

const LEFT: Slot[] = ['head', 'glasses', 'accessory', 'watch']
const RIGHT: Slot[] = ['top', 'pants', 'shoes']

/** Человечек: слева и справа ячейки слотов, в центре — чиби в надетом (цвет вещи — по редкости). */
function Doll({ onSlot }: { onSlot: (itemId: string) => void }) {
  const { engine } = useGame()
  const { equipped } = engine.state.items
  const worn: Partial<Record<Slot, ItemDefinition>> = {}
  for (const slot of SLOTS) {
    const item = equipped[slot] ? engine.content.item(equipped[slot]!) : undefined
    if (item) worn[slot] = item
  }
  const cell = (slot: Slot) => {
    const item = worn[slot]
    return (
      <button key={slot} class={`slot ${item ? `rarity--${item.rarity}` : 'slot--empty'}`} title={t(`slot.${slot}`)}
        onClick={() => item && onSlot(item.id)}>
        <ItemIcon slot={slot} />
        <span class="slot__label">{t(`slot.${slot}`)}</span>
      </button>
    )
  }
  return (
    <div class="doll">
      <div class="doll__col">{LEFT.map(cell)}</div>
      <div class="doll__figure"><Chibi worn={worn} /></div>
      <div class="doll__col">{RIGHT.map(cell)}</div>
    </div>
  )
}

/** Глобальные бонусы: вещи — всегда; перки — если хоть один действует (сумма и список с таймерами). */
function Bonuses() {
  const game = useGame()
  const { engine } = game
  const now = game.now()
  const items = itemTotals(engine.content, engine.state)
  const perks = perkTotals(engine.content, engine.state, now)
  const active = activeEffects(engine.content, engine.state, now)
  const line = (stats: Record<StatKey, number>) => STATS.filter((s) => stats[s] > 0)
  return (
    <div class="bonuses">
      <div class="bonuses__title">{t('wardrobe.itemBonuses')}</div>
      {line(items).length === 0
        ? <div class="bonuses__none">{t('wardrobe.noStats')}</div>
        : <div class="bonuses__row">{line(items).map((s) => (
            <span key={s} class="bonuses__stat">
              {t(`statName.${s}`)} {statTotal(s, items[s])}{s === 'gradeDiscount' && <small> · {t('wardrobe.gradeLater')}</small>}
            </span>
          ))}</div>}
      {active.length > 0 && (
        <>
          <div class="bonuses__title">{t('wardrobe.perkBonuses')}</div>
          <div class="bonuses__row">{line(perks).map((s) => (
            <span key={s} class="bonuses__stat">{t(`statName.${s}`)} {statValue(s, perks[s])}</span>
          ))}</div>
          {active.map(({ perk, remaining }, i) => (
            <div key={`${perk.id}-${i}`} class="bonuses__perk">
              <span>{perkIcon[perk.kind]} {perkLabel(perk)}</span>
              <span class="bonuses__time">{timer(remaining)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/** Шкаф: фильтры по слоту и редкости, карточки вещей со сравнением и «Надеть»/«Снять». */
export function Closet({ fresh, open: openProp, setOpen: setOpenProp }: { fresh: Set<string>; open?: string | null; setOpen?: (id: string | null) => void }) {
  const game = useGame()
  const { engine } = game
  const [slot, setSlot] = useState<Slot | null>(null)
  const [rarity, setRarity] = useState<Rarity | null>(null)
  const [ownOpen, setOwnOpen] = useState<string | null>(null)
  const open = openProp !== undefined ? openProp : ownOpen
  const setOpen = setOpenProp ?? setOwnOpen
  const items = engine.state.items.owned
    .map((id) => engine.content.item(id)!)
    .filter((i) => i && (!slot || i.slot === slot) && (!rarity || i.rarity === rarity))
    .sort((a, b) => Number(fresh.has(b.id)) - Number(fresh.has(a.id)) || RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity))
  return (
    <>
      <div class="chips">
        <button class={`chip ${slot === null ? 'chip--on' : ''}`} onClick={() => setSlot(null)}>{t('wardrobe.all')}</button>
        {SLOTS.map((s) => (
          <button key={s} class={`chip ${slot === s ? 'chip--on' : ''}`} onClick={() => setSlot(slot === s ? null : s)}>{SLOT_EMOJI[s]}</button>
        ))}
      </div>
      <div class="chips">
        <button class={`chip ${rarity === null ? 'chip--on' : ''}`} onClick={() => setRarity(null)}>{t('wardrobe.all')}</button>
        {RARITIES.map((r) => (
          <button key={r} class={`chip rarity-text--${r} ${rarity === r ? 'chip--on' : ''}`} onClick={() => setRarity(rarity === r ? null : r)}>
            {t(`rarity.${r}`)}
          </button>
        ))}
      </div>
      {items.length === 0 && <p class="backpack__empty">{t('wardrobe.empty')}</p>}
      {items.map((item) => (
        <ItemCard key={item.id} item={item} fresh={fresh.has(item.id)} open={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)} />
      ))}
    </>
  )
}

/** «Скорость: +50% → +100%», «Новый стат: зарплата +10%», «Стат пропадёт: скорость +100%». */
function CompareLine({ row }: { row: CompareRow }) {
  const name = t(`statName.${row.stat}`)
  const text = row.before === 0
    ? t('wardrobe.newStat', name, statValue(row.stat, row.after))
    : row.after === 0
      ? t('wardrobe.lostStat', name, statValue(row.stat, row.before))
      : `${name}: ${statTotal(row.stat, row.before)} → ${statTotal(row.stat, row.after)}`
  return <div class={`cmp cmp--${row.verdict}`}>{text}</div>
}

/** «Снимется «Кепка эникейщика»: скорость +50% → +0%». */
function RemovesLine({ itemId, rows }: { itemId: string; rows: CompareRow[] }) {
  const { engine } = useGame()
  const item = engine.content.item(itemId)
  if (!item) return null
  const row = rows.find((r) => r.stat === item.stat)
  const change = row ? `${t(`statName.${row.stat}`)} ${statTotal(row.stat, row.before)} → ${statTotal(row.stat, row.after)}` : ''
  return <div class="cmp cmp--worse">{t('wardrobe.removes', t(`item.${itemId}.name`), change)}</div>
}

function ItemIcon({ slot }: { slot: Slot }) {
  const src = iconUrl(`slot_${slot}`)
  return src ? <Icon src={src} class="slot__icon" /> : <span class="slot__emoji" aria-hidden="true">{SLOT_EMOJI[slot]}</span>
}

function ItemCard({ item, fresh, open, onToggle }: { item: ItemDefinition; fresh: boolean; open: boolean; onToggle: () => void }) {
  const game = useGame()
  const { engine } = game
  const worn = engine.state.items.equipped[item.slot] === item.id
  const cmp = open && !worn ? compareEquip(engine.content, engine.state, item.id) : null
  return (
    <div class={`item rarity--${item.rarity}`}>
      <button class="item__row" onClick={onToggle}>
        <ItemIcon slot={item.slot} />
        <div class="item__info">
          <div class="item__name">{t(`item.${item.id}.name`)}</div>
          <div class="item__meta">
            <span class={`rarity-text--${item.rarity}`}>{t(`rarity.${item.rarity}`)}</span> · {t(`slot.${item.slot}`)} · {statLabel(item.stat, item.value)}
          </div>
        </div>
        {worn && <span class="item__worn">{t('wardrobe.equipped')}</span>}
        {fresh && <span class="menu__new">{t('menu.new')}</span>}
      </button>
      {open && (
        <div class="item__details">
          {cmp && cmp.rows.map((row) => <CompareLine key={row.stat} row={row} />)}
          {cmp?.removes && <RemovesLine itemId={cmp.removes} rows={cmp.rows} />}
          {worn
            ? <button class="item__action item__action--off" onClick={() => game.unequip(item.slot)}>{t('wardrobe.unequip')}</button>
            : <button class="item__action" onClick={() => game.equip(item.id)}>{t('wardrobe.equip')}</button>}
        </div>
      )}
    </div>
  )
}
