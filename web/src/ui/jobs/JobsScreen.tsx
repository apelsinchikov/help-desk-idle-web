import { t } from '../../app/strings.ts'
import { useGame } from '../context.ts'
import { Header } from './Header.tsx'
import { JobCard } from './JobCard.tsx'

/** Главный экран: шапка, список работ, нижняя панель. */
export function JobsScreen() {
  const game = useGame()
  const { engine } = game
  const hireable = engine.content.jobs.filter((j) => engine.canHireManager(j.id)).length
  const hasNew = engine.state.ui.sections.some((s) => s !== 'settings' && !engine.state.ui.hintsSeen.includes(s))
  return (
    <div class="screen">
      <Header />
      <main class="jobs">
        {engine.content.jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </main>
      <nav class="bottom">
        <button class="bottom__menu" data-tutorial="menu" onClick={() => game.navigate('menu')}>
          <span aria-hidden="true">☰</span> {t('nav.menu')}
          {hireable > 0 ? <span class="badge">{hireable}</span> : hasNew && <span class="badge badge--dot" />}
        </button>
        <div class="bottom__shop">
          <span aria-hidden="true">🎁</span> {t('nav.shop')} <small>· {t('common.soon')}</small>
        </div>
      </nav>
    </div>
  )
}
