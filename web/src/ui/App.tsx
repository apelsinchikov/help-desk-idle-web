import type { Signal } from '@preact/signals'
import type { Game } from '../app/store.ts'
import { GameContext } from './context.ts'
import { JobsScreen } from './jobs/JobsScreen.tsx'
import { Loading } from './Loading.tsx'
import { Managers } from './Managers.tsx'
import { Menu } from './Menu.tsx'
import { Settings } from './Settings.tsx'
import { WelcomeBack } from './WelcomeBack.tsx'

export type Phase = 'loading' | 'playing'

export function App({ game, phase }: { game: Game; phase: Signal<Phase> }) {
  if (phase.value === 'loading') {
    return <GameContext.Provider value={game}><Loading /></GameContext.Provider>
  }
  const route = game.route.value
  const report = game.offlineReport.value
  return (
    <GameContext.Provider value={game}>
      <JobsScreen />
      {route === 'menu' && <Menu />}
      {route === 'managers' && <Managers />}
      {route === 'settings' && <Settings />}
      {report && <WelcomeBack report={report} />}
    </GameContext.Provider>
  )
}
