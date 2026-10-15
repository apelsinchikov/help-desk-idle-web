import { t } from '../app/strings.ts'
import { useGame } from './context.ts'

/** Меню — колонка кнопок поверх затемнённой игры (игра продолжает идти). */
export function Menu() {
  const game = useGame()
  const { engine } = game
  const hireable = engine.content.jobs.filter((j) => engine.canHireManager(j.id)).length
  const close = () => (game.route.value = 'jobs')

  return (
    <div class="overlay" onClick={close}>
      <div class="menu" onClick={(e) => e.stopPropagation()}>
        <button class="menu__item" onClick={() => (game.route.value = 'managers')}>
          <i class="dot" style={{ background: 'var(--managers)' }} />
          {t('menu.managers')}
          {hireable > 0 && <span class="menu__badge">{hireable}</span>}
        </button>
        {['menu.achievements', 'menu.upgrades', 'menu.wardrobe', 'menu.reorg'].map((key) => (
          <div class="menu__item menu__item--locked" key={key}>
            <span aria-hidden="true">🔒</span>
            {t(key)}
            <small>{t('common.soon')}</small>
          </div>
        ))}
        <button class="menu__item" onClick={() => (game.route.value = 'settings')}>
          <i class="dot" style={{ background: 'var(--muted)' }} />
          {t('menu.settings')}
        </button>
        <button class="menu__close" aria-label={t('common.close')} onClick={close}>✕</button>
      </div>
    </div>
  )
}
