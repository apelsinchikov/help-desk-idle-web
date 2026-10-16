import type { Signal } from '@preact/signals'
import type { Game } from '../app/store.ts'
import { GameContext } from './context.ts'
import { JobsScreen } from './jobs/JobsScreen.tsx'
import { Loading } from './Loading.tsx'
import { Achievements } from './Achievements.tsx'
import { Backpack } from './Backpack.tsx'
import { Managers } from './Managers.tsx'
import { MessageSlot } from './MessageSlot.tsx'
import { Menu } from './Menu.tsx'
import { Settings } from './Settings.tsx'
import { Tutorial } from './Tutorial.tsx'
import { Upgrades } from './Upgrades.tsx'
import { WelcomeBack } from './WelcomeBack.tsx'

export type Phase = 'loading' | 'playing'

export function App({ game, phase, devBuild = false }: { game: Game; phase: Signal<Phase>; devBuild?: boolean }) {
  // Техническая метка тестовой сборки, не переводится.
  const badge = devBuild && <div class="dev-badge">DEV</div>
  if (phase.value === 'loading') {
    return <GameContext.Provider value={game}><Loading />{badge}</GameContext.Provider>
  }
  const route = game.route.value
  const report = game.offlineReport.value
  return (
    <GameContext.Provider value={game}>
      <JobsScreen />
      {route === 'menu' && <Menu />}
      {route === 'managers' && <Managers />}
      {route === 'settings' && <Settings />}
      {route === 'upgrades' && <Upgrades />}
      {route === 'achievements' && <Achievements />}
      {route === 'backpack' && <Backpack />}
      <MessageSlot />
      {!report && <Tutorial />}
      {report && <WelcomeBack report={report} />}
      {badge}
    </GameContext.Provider>
  )
}
