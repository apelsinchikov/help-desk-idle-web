import type { Signal } from '@preact/signals'
import type { Game } from '../app/store.ts'
import { GameContext } from './context.ts'
import { JobsScreen } from './jobs/JobsScreen.tsx'
import { Loading } from './Loading.tsx'

export type Phase = 'loading' | 'playing'

export function App({ game, phase }: { game: Game; phase: Signal<Phase> }) {
  return (
    <GameContext.Provider value={game}>
      {phase.value === 'loading' ? <Loading /> : <JobsScreen />}
    </GameContext.Provider>
  )
}
