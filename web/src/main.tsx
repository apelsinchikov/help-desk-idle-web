import { render } from 'preact'
import { signal } from '@preact/signals'
import { bundledContent } from './core/bundled.ts'
import { GameEngine } from './core/engine.ts'
import { newGame } from './core/state.ts'
import { createLocalSave } from './platform/storage.ts'
import { createSaveScheduler } from './app/saveScheduler.ts'
import { createGame } from './app/store.ts'
import type { CloudStatus } from './app/store.ts'
import { uiLanguage } from './app/strings.ts'
import { detectLanguage } from './app/i18n.ts'
import { App } from './ui/App.tsx'
import type { Phase } from './ui/App.tsx'
import './theme/tokens.css'
import './theme/fonts.css'
import './ui/styles.css'

const MIN_LOADING_MS = 1400

const content = bundledContent
const localSave = createLocalSave()
const state = localSave.load() ?? newGame(content, Date.now(), detectLanguage(navigator.language))
const engine = new GameEngine(content, state)
const cloudStatus = signal<CloudStatus>({ kind: 'disabled' })
const scheduler = createSaveScheduler({
  saveLocal: () => localSave.save(engine.state),
  uploadCloud: async () => {},
  localIntervalMs: content.config.autosaveSeconds * 1000,
  cloudIntervalMs: 30_000,
  now: Date.now,
})
const game = createGame({ engine, scheduler, cloudStatus, language: uiLanguage })
const phase = signal<Phase>('loading')

render(<App game={game} phase={phase} />, document.getElementById('app')!)

async function boot() {
  await new Promise((r) => setTimeout(r, MIN_LOADING_MS))
  phase.value = 'playing'
  game.onVisible()
}

document.addEventListener('visibilitychange', () => {
  if (phase.value !== 'playing') return
  if (document.visibilityState === 'hidden') void game.onHidden()
  else game.onVisible()
})
window.addEventListener('pagehide', () => {
  if (phase.value === 'playing') void game.onHidden()
})

void boot()
