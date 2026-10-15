import { render } from 'preact'
import { effect, signal } from '@preact/signals'
import { bundledContent } from './core/bundled.ts'
import { GameEngine } from './core/engine.ts'
import { pickSave } from './core/savePicker.ts'
import { newGame } from './core/state.ts'
import { createCloud } from './platform/cloud.ts'
import { createLocalSave } from './platform/storage.ts'
import { telegram } from './platform/telegram.ts'
import { createSaveScheduler } from './app/saveScheduler.ts'
import { createGame } from './app/store.ts'
import type { CloudStatus } from './app/store.ts'
import { uiLanguage } from './app/strings.ts'
import { detectLanguage } from './app/i18n.ts'
import { withTimeout } from './app/timeout.ts'
import { App } from './ui/App.tsx'
import type { Phase } from './ui/App.tsx'
import './theme/tokens.css'
import './theme/fonts.css'
import './ui/styles.css'

const MIN_LOADING_MS = 1400
const CLOUD_TIMEOUT_MS = 4000

telegram.init(getComputedStyle(document.documentElement).getPropertyValue('--background').trim())

const content = bundledContent
const localSave = createLocalSave()
const local = localSave.load()
const state = local ?? newGame(content, Date.now(), detectLanguage(telegram.languageCode ?? navigator.language))
const engine = new GameEngine(content, state)

// Облако — только в Telegram и только если сборка знает адрес и ключ проекта.
const cloud = createCloud(
  { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  telegram.initData,
)
const cloudStatus = signal<CloudStatus>({ kind: cloud ? 'syncing' : 'disabled' })

const scheduler = createSaveScheduler({
  saveLocal: () => localSave.save(engine.state),
  uploadCloud: async () => {
    if (!cloud) return
    try {
      await cloud.upload(engine.state)
      cloudStatus.value = { kind: 'synced', at: Date.now() }
    } catch (error) {
      cloudStatus.value = { kind: 'offline' }
      throw error
    }
  },
  localIntervalMs: content.config.autosaveSeconds * 1000,
  cloudIntervalMs: 30_000,
  now: Date.now,
})
const game = createGame({ engine, scheduler, cloudStatus, language: uiLanguage, haptic: telegram.haptic })
const phase = signal<Phase>('loading')

// Кнопка «Назад» Telegram закрывает меню и листы.
effect(() => {
  const route = game.route.value
  telegram.onBack(route === 'jobs' ? null : () => (game.route.value = route === 'menu' ? 'jobs' : 'menu'))
})

render(<App game={game} phase={phase} />, document.getElementById('app')!)

/** При запуске берём облачный сейв, если в нём заработано больше (pickSave). Плохая сеть не держит загрузку. */
async function syncFromCloud(): Promise<void> {
  if (!cloud) return
  try {
    const remote = await withTimeout(cloud.signIn().then(() => cloud.download()), CLOUD_TIMEOUT_MS)
    const chosen = pickSave(local, remote)
    if (chosen && chosen !== local) {
      engine.replaceState(chosen)
      uiLanguage.value = chosen.settings.language
      localSave.save(chosen)
    }
    cloudStatus.value = { kind: 'synced', at: Date.now() }
  } catch {
    cloudStatus.value = { kind: 'offline' }
  }
}

async function boot() {
  await Promise.all([syncFromCloud(), new Promise((r) => setTimeout(r, MIN_LOADING_MS))])
  phase.value = 'playing'
  game.onVisible()
}

document.addEventListener('visibilitychange', () => {
  if (phase.value !== 'playing') return
  if (document.visibilityState === 'hidden') void game.onHidden()
  else game.onVisible()
})
// Telegram 8.0+: Mini App свернули в «плашку» / развернули обратно.
telegram.onLifecycle(
  () => { if (phase.value === 'playing') void game.onHidden() },
  () => { if (phase.value === 'playing') game.onVisible() },
)
window.addEventListener('pagehide', () => {
  if (phase.value === 'playing') void game.onHidden()
})

void boot()
