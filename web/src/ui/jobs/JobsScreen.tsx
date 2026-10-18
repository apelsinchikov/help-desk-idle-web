import { t } from '../../app/strings.ts'
import { buyableCounts } from '../../core/progress.ts'
import { useGame } from '../context.ts'
import { Header } from './Header.tsx'
import { QuestStrip } from '../QuestStrip.tsx'
import { EnergyBar } from '../EnergyBar.tsx'
import { JobCard } from './JobCard.tsx'

/** Главный экран: шапка, список работ, нижняя панель. */
export function JobsScreen() {
  const game = useGame()
  const { engine } = game
  const buyable = buyableCounts(engine)
  const alert = buyable.managers + buyable.upgrades + buyable.perks + buyable.items + buyable.reorg > 0
  return (
    <div class="screen">
      <Header />
      <QuestStrip />
      <main class="jobs">
        {engine.content.jobs.map((job) => <JobCard key={job.id} job={job} />)}
      </main>
      <nav class="bottom">
        <button class="bottom__menu" data-tutorial="menu" aria-label={t('nav.menu')} onClick={() => game.navigate('menu')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          {alert && <span class="badge badge--dot" aria-label={t('menu.canBuy')} />}
        </button>
        <EnergyBar />
        <button class="bottom__shop" aria-label={t('nav.shop')} onClick={() => game.navigate('shop')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M3 12h18M12 8v13M12 8c-2-4-6-4-6-1 0 2 6 1 6 1zm0 0c2-4 6-4 6-1 0 2-6 1-6 1z" /></svg>
        </button>
      </nav>
    </div>
  )
}
