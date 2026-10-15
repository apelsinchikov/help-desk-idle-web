import { t } from '../app/strings.ts'
import type { Route } from '../app/store.ts'
import { useGame } from './context.ts'

type Item = { section: 'managers' | 'achievements' | 'upgrades'; key: string; color: string }
const ITEMS: Item[] = [
  { section: 'managers', key: 'menu.managers', color: 'var(--managers)' },
  { section: 'achievements', key: 'menu.achievements', color: 'var(--achievements)' },
  { section: 'upgrades', key: 'menu.upgrades', color: 'var(--upgrades)' },
]

/** Меню — колонка кнопок поверх затемнённой игры. Разделы появляются по мере прогресса. */
export function Menu() {
  const game = useGame()
  const { engine } = game
  const ui = engine.state.ui
  const hireable = engine.content.jobs.filter((j) => engine.canHireManager(j.id)).length
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
              onClick={() => game.navigate(item.section as Route)}
            >
              <i class="dot" style={{ background: item.color }} />
              {t(item.key)}
              {item.section === 'managers' && hireable > 0 ? (
                <span class="menu__badge">{hireable}</span>
              ) : (
                !ui.hintsSeen.includes(item.section) && <span class="menu__new">{t('menu.new')}</span>
              )}
            </button>
          ) : (
            <Locked key={item.key} label={t(item.key)} />
          ),
        )}
        <Locked label={t('menu.wardrobe')} />
        <Locked label={t('menu.reorg')} />
        <button class="menu__item" onClick={() => game.navigate('settings')}>
          <i class="dot" style={{ background: 'var(--muted)' }} />
          {t('menu.settings')}
        </button>
        <button class="menu__close" aria-label={t('common.close')} onClick={close}>✕</button>
      </div>
    </div>
  )
}

function Locked({ label }: { label: string }) {
  return (
    <div class="menu__item menu__item--locked">
      <span aria-hidden="true">🔒</span>
      {label}
      <small>{t('common.soon')}</small>
    </div>
  )
}
