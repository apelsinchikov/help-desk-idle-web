// Связывает движок с UI (signals), тиком и сохранением. Аналог AppModel.swift без облака и навигации iOS.
import { signal } from '@preact/signals'
import type { Signal } from '@preact/signals'
import type { GameEngine } from '../core/engine.ts'
import type { AppLanguage } from '../core/format.ts'
import type { BuyMode, OfflineReport } from '../core/state.ts'
import { achievementText } from '../core/achievements.ts'
import type { AchievementText } from '../core/achievements.ts'
import type { Milestone } from '../core/content.ts'
import { refreshSections, tutorialAck, tutorialAdvance } from '../core/progress.ts'
import type { SaveScheduler } from './saveScheduler.ts'

export type CloudStatus =
  | { kind: 'disabled' }
  | { kind: 'syncing' }
  | { kind: 'synced'; at: number }
  | { kind: 'offline' }

export type Route = 'jobs' | 'menu' | 'managers' | 'settings' | 'upgrades' | 'achievements'

const TICK_MS = 100

export function createGame(o: {
  engine: GameEngine
  scheduler: SaveScheduler
  cloudStatus: Signal<CloudStatus>
  /** Общий сигнал языка интерфейса (strings.ts). */
  language: Signal<AppLanguage>
  /** Вибро платформы (Telegram); вызывается, только если включено в настройках. */
  haptic?: (kind: 'light' | 'success') => void
}) {
  const { engine, scheduler } = o
  /** Растёт после любого изменения состояния: компоненты читают его, затем данные из engine. */
  const version = signal(0)
  const buyMode = signal<BuyMode>('one')
  const offlineReport = signal<OfflineReport | null>(null)
  const route = signal<Route>('jobs')
  const language = o.language
  language.value = engine.state.settings.language
  /** Очередь тостов достижений; UI показывает первый и снимает dismissToast(). */
  const toasts = signal<AchievementText[]>([])
  let timer: ReturnType<typeof setInterval> | null = null

  /** После любого изменения: разделы меню, шаги обучения, перерисовка. */
  const bump = () => {
    refreshSections(engine)
    tutorialAdvance(engine, route.value, buyMode.value)
    version.value++
  }

  const game = {
    engine,
    version,
    buyMode,
    offlineReport,
    route,
    language,
    cloudStatus: o.cloudStatus,
    toasts,

    /** Действие игрока: покупки сохраняются сразу, тапы — по интервалу автосейва. */
    act(kind: 'purchase' | 'tap', fn: () => void): void {
      fn()
      bump()
      scheduler.changed(kind === 'purchase' ? 'purchase' : 'tick')
    },

    /** Повышение на пороге: тост с наградой, сохранение сразу. */
    promote(jobId: string): void {
      const gained: Milestone[] = []
      game.act('purchase', () => { gained.push(...(engine.promote(jobId) ?? [])) })
      if (gained.length === 0) return
      game.haptic('success')
      const index = engine.content.jobs.findIndex((j) => j.id === jobId)
      toasts.value = [...toasts.value, ...gained.map((m) => achievementText(m, m.jobId === null ? -1 : index))]
    },

    buyUpgrade(upgradeId: string): void {
      game.act('purchase', () => { if (engine.buyUpgrade(upgradeId)) game.haptic('success') })
    },

    dismissToast(): void {
      toasts.value = toasts.value.slice(1)
    },

    ackTutorial(): void {
      game.act('purchase', () => tutorialAck(engine, route.value, buyMode.value))
    },

    markHintSeen(section: string): void {
      if (engine.state.ui.hintsSeen.includes(section)) return
      game.act('purchase', () => engine.state.ui.hintsSeen.push(section))
    },

    /** Смена экрана тоже двигает обучение (шаги «Нажми Меню» → «Менеджеры»). */
    navigate(next: Route): void {
      route.value = next
      bump()
    },

    haptic(kind: 'light' | 'success'): void {
      if (engine.state.settings.haptics) o.haptic?.(kind)
    },

    setLanguage(next: AppLanguage): void {
      game.act('purchase', () => engine.updateSettings({ language: next }))
      language.value = next
    },

    /** «Начать заново»: локально и в облако сразу, иначе облачный сейв вернул бы старый прогресс. */
    async reset(): Promise<void> {
      game.act('purchase', () => engine.reset(Date.now()))
      await scheduler.flush()
    },

    startTicking(): void {
      if (timer !== null) return
      timer = setInterval(() => {
        // resume, а не advance: большой разрыв между тиками (замороженный WebView, перевод часов)
        // проходит через оффлайн-лимит и показывает «С возвращением».
        const report = engine.resume(Date.now())
        if (report) offlineReport.value = report
        bump()
        scheduler.changed('tick')
      }, TICK_MS)
    },

    stopTicking(): void {
      if (timer !== null) clearInterval(timer)
      timer = null
    },

    /** Mini App свернули или закрывают: догнать время и сохранить всё. */
    async onHidden(): Promise<void> {
      game.stopTicking()
      engine.advance(Date.now())
      await scheduler.flush()
    },

    /** Вернулись: оффлайн-доход и «С возвращением». */
    onVisible(): void {
      if (timer !== null) return
      const report = engine.resume(Date.now())
      if (report) offlineReport.value = report
      bump()
      game.startTicking()
    },
  }
  return game
}

export type Game = ReturnType<typeof createGame>
