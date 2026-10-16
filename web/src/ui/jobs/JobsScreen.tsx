import { t } from '../../app/strings.ts'
import { buyableCounts } from '../../core/progress.ts'
import { useGame } from '../context.ts'
import { Header } from './Header.tsx'
import { EffectsBar } from '../EffectsBar.tsx'
import { JobCard } from './JobCard.tsx'

/** Главный экран: шапка, список работ, нижняя панель. */
export function JobsScreen() {
  const game = useGame()
  const { engine } = game
  const buyable = buyableCounts(engine)
  const alert = buyable.managers + buyable.upgrades + buyable.perks + buyable.items > 0
  return (
    <div class="screen">
      <Header />
      <EffectsBar />
      <main class="jobs">
        {engine.content.jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </main>
      <nav class="bottom">
        <button class="bottom__menu" data-tutorial="menu" onClick={() => game.navigate('menu')}>
          <span aria-hidden="true">☰</span> {t('nav.menu')}
          {alert && <span class="badge badge--dot" aria-label={t('menu.canBuy')} />}
        </button>
        <div class="bottom__shop">
          <span aria-hidden="true">🎁</span> {t('nav.shop')} <small>· {t('common.soon')}</small>
        </div>
      </nav>
    </div>
  )
}
