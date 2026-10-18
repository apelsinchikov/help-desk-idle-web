import { t } from '../app/strings.ts'
import type { Route } from '../app/store.ts'
import { buyableCounts, sectionLock, type SectionLock } from '../core/progress.ts'
import { money, useGame } from './context.ts'

type Item = { section: 'quests' | 'managers' | 'achievements' | 'upgrades' | 'backpack' | 'wardrobe' | 'reorg'; key: string; color: string }
const ITEMS: Item[] = [
  { section: 'quests', key: 'menu.quests', color: 'var(--accent)' },
  { section: 'managers', key: 'menu.managers', color: 'var(--managers)' },
  { section: 'achievements', key: 'menu.achievements', color: 'var(--achievements)' },
  { section: 'upgrades', key: 'menu.upgrades', color: 'var(--upgrades)' },
  { section: 'backpack', key: 'menu.backpack', color: 'var(--backpack)' },
  { section: 'wardrobe', key: 'menu.wardrobe', color: 'var(--wardrobe)' },
  { section: 'reorg', key: 'menu.reorg', color: 'var(--reorg)' },
]

/** Меню — колонка кнопок поверх затемнённой игры. Разделы появляются по мере прогресса. */
export function Menu() {
  const game = useGame()
  const { engine } = game
  const ui = engine.state.ui
  const buyable = buyableCounts(engine)
  const counts: Partial<Record<Item['section'], number>> = { managers: buyable.managers, upgrades: buyable.upgrades, backpack: buyable.perks, wardrobe: buyable.items, reorg: buyable.reorg }
  const close = () => game.navigate('jobs')

  return (
    <div class="overlay" onClick={close}>
      <div class="menu" onClick={(e) => e.stopPropagation()}>
        {ITEMS.map((item) =>
          ui.sections.includes(item.section) ? (
            <button
              key={item.key}
              class="menu__item"
              data-tutorial={`menu-${item.section}`}
              onClick={() => { game.coinTab.value = 'cash'; game.navigate(item.section as Route) }}
            >
              <i class="dot" style={{ background: item.color }} />
              {t(item.key)}
              {(counts[item.section] ?? 0) > 0 ? (
                <span class="menu__badge">{counts[item.section]}</span>
              ) : (
                !ui.hintsSeen.includes(item.section) && <span class="menu__new">{t('menu.new')}</span>
              )}
            </button>
          ) : (
            <Locked key={item.key} label={t(item.key)} lock={sectionLock(engine, item.section)} />
          ),
        )}
        {game.leaderboard ? (
          <button class="menu__item" onClick={() => game.navigate('leaderboard')}>
            <i class="dot" style={{ background: 'var(--leaderboard)' }} />
            {t('menu.leaderboard')}
          </button>
        ) : (
          <div class="menu__item menu__item--locked">
            <span aria-hidden="true">🔒</span>
            <span class="menu__label">{t('menu.leaderboard')}<span class="menu__req">{t('leaderboard.telegramOnly')}</span></span>
          </div>
        )}
        <button class="menu__item" onClick={() => game.navigate('settings')}>
          <i class="dot" style={{ background: 'var(--muted)' }} />
          {t('menu.settings')}
        </button>
        <button class="menu__close" aria-label={t('common.close')} onClick={close}>✕</button>
      </div>
    </div>
  )
}

/** Закрытый пункт: lock — что сделать, чтобы открыть; без lock — раздела ещё нет в игре (Coming soon). */
function Locked({ label, lock }: { label: string; lock?: SectionLock | null }) {
  return (
    <div class="menu__item menu__item--locked">
      <span aria-hidden="true">🔒</span>
      {lock ? (
        <span class="menu__label">
          {label}
          <span class="menu__req">{requirement(lock)}</span>
        </span>
      ) : (
        <>
          {label}
          <small>{t('common.soon')}</small>
        </>
      )}
    </div>
  )
}

function requirement(lock: SectionLock): string {
  switch (lock.kind) {
    case 'rank': return t('menu.lock.rank', lock.need, lock.best)
    case 'earn': return t('menu.lock.earn', money(lock.need), money(lock.have))
    case 'stars': return t('menu.lock.stars', lock.need, lock.have)
    case 'tutorial': return t('menu.lock.tutorial')
  }
}
