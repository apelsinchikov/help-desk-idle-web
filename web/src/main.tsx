import { render } from 'preact'
import { effect, signal } from '@preact/signals'
import { bundledContent } from './core/bundled.ts'
import { GameEngine } from './core/engine.ts'
import { newGame } from './core/state.ts'
import type { GameState } from './core/state.ts'
import { createCloud } from './platform/cloud.ts'
import { createLocalSave } from './platform/storage.ts'
import { telegram } from './platform/telegram.ts'
import { createSaveScheduler } from './app/saveScheduler.ts'
import { createCloudGate } from './app/cloudGate.ts'
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
const isDevBuild = import.meta.env.VITE_CHANNEL === 'dev'
// Сейвы тестовой сборки отдельно от рабочих (один домен github.io); в Telegram — по аккаунту.
const saveAccount = isDevBuild ? 'dev' : telegram.userId !== undefined ? `tg${telegram.userId}` : undefined
const localSave = createLocalSave(undefined, saveAccount)
const state = localSave.load() ?? newGame(content, Date.now(), detectLanguage(telegram.languageCode ?? navigator.language))
const engine = new GameEngine(content, state)

// Облако — только в Telegram и только если сборка знает адрес и ключ проекта.
const cloud = createCloud(
  { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
  { initData: telegram.initData, userId: telegram.userId },
)
const cloudStatus = signal<CloudStatus>({ kind: cloud ? 'syncing' : 'disabled' })

/** Облачный сейв оказался лучше (новое устройство, очищенный WebView) — играем им. */
function adopt(remote: GameState): void {
  engine.replaceState(remote)
  uiLanguage.value = remote.settings.language
  localSave.save(remote)
  game.version.value++
}
const gate = cloud && createCloudGate({ cloud, current: () => engine.state, adopt })

const scheduler = createSaveScheduler({
  saveLocal: () => localSave.save(engine.state),
  uploadCloud: async () => {
    if (!gate) return
    try {
      await gate.upload()
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
  telegram.onBack(route === 'jobs' ? null : () => game.navigate(route === 'menu' ? 'jobs' : 'menu'))
})

render(<App game={game} phase={phase} devBuild={isDevBuild} />, document.getElementById('app')!)

/**
 * При запуске берём облачный сейв, если в нём заработано больше. Плохая сеть не держит загрузку дольше 4 с:
 * загрузка продолжится в фоне, а выгрузки в облако подождут её (cloudGate).
 */
async function syncFromCloud(): Promise<void> {
  if (!gate) return
  try {
    await withTimeout(gate.reconcile(), CLOUD_TIMEOUT_MS)
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
