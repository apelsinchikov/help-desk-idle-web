// Прогресс игрока вне экономики: открытие разделов меню и обучение главного экрана.
// Всё хранится в state.ui, поэтому едет в облако вместе с сейвом.
import type { GameEngine } from './engine.ts'

export type Section = 'managers' | 'achievements' | 'upgrades' | 'settings'

/** Дописывает в ui.sections разделы, которые пора открыть; возвращает только новые. */
export function refreshSections(engine: GameEngine): Section[] {
  const { state, content } = engine
  const jobs = Object.values(state.jobs)
  const cheapestUpgrade = content.upgrades[0]?.cost ?? Infinity
  const open: Record<Section, boolean> = {
    settings: true,
    managers: jobs.some((j) => j.level >= content.config.managerMinLevel || j.hasManager),
    achievements: jobs.some((j) => j.rank > 0),
    upgrades: state.lifetimeEarnings >= cheapestUpgrade,
  }
  const added: Section[] = []
  for (const section of Object.keys(open) as Section[]) {
    if (open[section] && !state.ui.sections.includes(section)) {
      state.ui.sections.push(section)
      added.push(section)
    }
  }
  return added
}

export type TutorialTarget =
  | { kind: 'job-icon' | 'job-panel' | 'job-unlock' | 'manager-hire'; jobId: string }
  | { kind: 'buy-mode' | 'menu' | 'menu-managers' | 'none' }

export type TutorialView = { step: number; textKey: string; target: TutorialTarget; needsAck: boolean }

type Ctx = { engine: GameEngine; route: string }
type Step = {
  target: (c: Ctx) => TutorialTarget
  /** Когда шаг показывать (иначе ждём). */
  show: (c: Ctx) => boolean
  /** Когда шаг считается пройденным (в том числе «уже пройден» у старого сейва). */
  done: (c: Ctx) => boolean
  needsAck?: boolean
}

const FIRST = 'reboot'
const SECOND = 'plug_mouse'
const job = (c: Ctx, id: string) => c.engine.state.jobs[id]
const anyJob = (c: Ctx, f: (id: string) => boolean) => c.engine.content.jobs.some((j) => f(j.id))
const hasManager = (c: Ctx) => anyJob(c, (id) => job(c, id)?.hasManager ?? false)
const hireable = (c: Ctx) => c.engine.content.jobs.find((j) => c.engine.canHireManager(j.id))?.id

const STEPS: Step[] = [
  // 0 — тап по иконке
  { target: () => ({ kind: 'job-icon', jobId: FIRST }), show: () => true,
    done: (c) => c.engine.state.lifetimeEarnings > 0 || job(c, FIRST)?.startedAt !== null },
  // 1 — сбор
  { target: () => ({ kind: 'job-icon', jobId: FIRST }), show: (c) => c.engine.status(FIRST).kind === 'ready',
    done: (c) => c.engine.state.lifetimeEarnings > 0 },
  // 2 — покупка уровня
  { target: () => ({ kind: 'job-panel', jobId: FIRST }),
    show: (c) => { const q = c.engine.quote(FIRST, 'one'); return q.count > 0 && q.cost <= c.engine.state.money },
    done: (c) => (job(c, FIRST)?.level ?? 0) >= 2 },
  // 3 — режим покупки
  { target: () => ({ kind: 'buy-mode' }), show: (c) => (job(c, FIRST)?.level ?? 0) >= 4,
    done: (c) => (job(c, SECOND)?.level ?? 0) >= 1, needsAck: true },
  // 4 — открыть работу 2
  { target: () => ({ kind: 'job-unlock', jobId: SECOND }), show: (c) => c.engine.canUnlock(SECOND),
    done: (c) => (job(c, SECOND)?.level ?? 0) >= 1 },
  // 5 — повышение
  { target: (c) => ({ kind: 'job-panel', jobId: c.engine.content.jobs.find((j) => c.engine.atCap(j.id))?.id ?? FIRST }),
    show: (c) => anyJob(c, (id) => c.engine.atCap(id)),
    done: (c) => anyJob(c, (id) => (job(c, id)?.rank ?? 0) > 0) },
  // 6 — «Нажми Меню»
  { target: () => ({ kind: 'menu' }), show: (c) => hireable(c) !== undefined && c.route === 'jobs',
    done: (c) => c.route !== 'jobs' || hasManager(c) },
  // 7 — «Менеджеры»
  { target: () => ({ kind: 'menu-managers' }), show: (c) => c.route === 'menu',
    done: (c) => c.route === 'managers' || hasManager(c) },
  // 8 — «Нанять»
  { target: (c) => ({ kind: 'manager-hire', jobId: hireable(c) ?? FIRST }),
    show: (c) => c.route === 'managers' && hireable(c) !== undefined, done: hasManager },
  // 9 — итог
  { target: () => ({ kind: 'none' }), show: () => true, done: () => false, needsAck: true },
]

/** Пропускает все шаги, условие которых уже выполнено; после последнего — tutorialDone. */
export function tutorialAdvance(engine: GameEngine, route: string): void {
  const ui = engine.state.ui
  while (!ui.tutorialDone && STEPS[ui.tutorialStep]?.done({ engine, route })) next(engine)
}

/** «Понятно» на шаге, который ждёт подтверждения. */
export function tutorialAck(engine: GameEngine, route: string): void {
  const ui = engine.state.ui
  if (ui.tutorialDone || !STEPS[ui.tutorialStep]?.needsAck) return
  next(engine)
  tutorialAdvance(engine, route)
}

/** Что показать сейчас; null — обучение пройдено или текущий шаг ещё ждёт своего момента. */
export function tutorialView(engine: GameEngine, route: string): TutorialView | null {
  const ui = engine.state.ui
  const step = STEPS[ui.tutorialStep]
  if (ui.tutorialDone || !step) return null
  const ctx = { engine, route }
  if (!step.show(ctx)) return null
  return { step: ui.tutorialStep, textKey: `tutorial.${ui.tutorialStep}`, target: step.target(ctx), needsAck: !!step.needsAck }
}

function next(engine: GameEngine): void {
  const ui = engine.state.ui
  ui.tutorialStep += 1
  if (ui.tutorialStep >= STEPS.length) {
    ui.tutorialDone = true
    // итог обучения уже рассказал про менеджеров — подсказку раздела не повторяем
    if (!ui.hintsSeen.includes('managers')) ui.hintsSeen.push('managers')
  }
}
