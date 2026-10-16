// Прогресс игрока вне экономики: открытие разделов меню и обучение главного экрана.
// Всё хранится в state.ui, поэтому едет в облако вместе с сейвом.
import type { GameEngine } from './engine.ts'
import type { BuyMode } from './state.ts'

export type Section = 'managers' | 'achievements' | 'upgrades' | 'settings'

/** Что нужно, чтобы раздел меню открылся. */
export type SectionLock =
  | { kind: 'rank'; need: number; best: number } // повысить любую работу до ур. need (лучшая сейчас — best)
  | { kind: 'earn'; need: number; have: number } // заработать за всё время need

/** null — раздел уже можно открыть; иначе условие открытия. Единый источник правды для меню и refreshSections. */
export function sectionLock(engine: GameEngine, section: Section): SectionLock | null {
  const { state, content } = engine
  const jobs = Object.values(state.jobs)
  const best = Math.max(0, ...jobs.map((j) => j.rank))
  switch (section) {
    case 'settings':
      return null
    case 'managers': {
      // раздел открывается, когда хоть одной работе можно нанять менеджера; в подсказке — ближайший такой ранг
      const ready = content.jobs.some((j) => (state.jobs[j.id]?.rank ?? 0) >= content.managerRank(j.id))
      const need = Math.min(...content.jobs.map((j) => content.managerRank(j.id)))
      return ready || jobs.some((j) => j.hasManager) ? null : { kind: 'rank', need, best }
    }
    case 'achievements': {
      const need = Math.min(...content.milestones.filter((m) => m.jobId !== null).map((m) => m.level))
      return best >= need ? null : { kind: 'rank', need, best }
    }
    case 'upgrades': {
      const need = Math.min(...content.upgrades.map((u) => u.cost))
      return state.lifetimeEarnings >= need ? null : { kind: 'earn', need, have: state.lifetimeEarnings }
    }
  }
}

/** Сколько менеджеров и улучшений можно купить прямо сейчас — для точки на кнопке меню. */
export function buyableCounts(engine: GameEngine): { managers: number; upgrades: number } {
  const { content } = engine
  return {
    managers: content.jobs.filter((j) => engine.canHireManager(j.id)).length,
    upgrades: content.upgrades.filter((u) => engine.canBuyUpgrade(u.id)).length,
  }
}

/** Дописывает в ui.sections разделы, которые пора открыть; возвращает только новые. */
export function refreshSections(engine: GameEngine): Section[] {
  const { state } = engine
  const sections: Section[] = ['settings', 'managers', 'achievements', 'upgrades']
  const open = Object.fromEntries(sections.map((s) => [s, sectionLock(engine, s) === null])) as Record<Section, boolean>
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

type Ctx = { engine: GameEngine; route: string; buyMode: BuyMode }
type Step = {
  target: (c: Ctx) => TutorialTarget
  /** Когда шаг показывать (иначе ждём). Показ = действие обязано быть выполнимым, иначе игрок застрянет. */
  show: (c: Ctx) => boolean
  /** Когда шаг считается пройденным (в том числе «уже пройден» у старого сейва). */
  done: (c: Ctx) => boolean
  needsAck?: boolean
  /** Текст шага, если зависит от экрана. */
  textKey?: (c: Ctx) => string
}

const FIRST = 'reboot'
const SECOND = 'plug_mouse'
const job = (c: Ctx, id: string) => c.engine.state.jobs[id]
const anyJob = (c: Ctx, f: (id: string) => boolean) => c.engine.content.jobs.some((j) => f(j.id))
const hasManager = (c: Ctx) => anyJob(c, (id) => job(c, id)?.hasManager ?? false)
const hireable = (c: Ctx) => c.engine.content.jobs.find((j) => c.engine.canHireManager(j.id))?.id
const onJobs = (c: Ctx) => c.route === 'jobs'
/** Работа на пороге, повышение которой по карману. */
const promotable = (c: Ctx) =>
  c.engine.content.jobs.find((j) => c.engine.atCap(j.id) && c.engine.promotionCost(j.id) <= c.engine.state.money)?.id

const STEPS: Step[] = [
  // 0 — тап по иконке
  { target: () => ({ kind: 'job-icon', jobId: FIRST }), show: onJobs,
    done: (c) => c.engine.state.lifetimeEarnings > 0 || job(c, FIRST)?.startedAt !== null },
  // 1 — сбор
  { target: () => ({ kind: 'job-icon', jobId: FIRST }), show: (c) => onJobs(c) && c.engine.status(FIRST).kind === 'ready',
    done: (c) => c.engine.state.lifetimeEarnings > 0 },
  // 2 — покупка уровня (в текущем режиме покупки — его видит панель)
  { target: () => ({ kind: 'job-panel', jobId: FIRST }),
    show: (c) => {
      if (!onJobs(c)) return false
      const q = c.engine.quote(FIRST, c.buyMode)
      return q.count > 0 && q.cost <= c.engine.state.money
    },
    done: (c) => (job(c, FIRST)?.level ?? 0) >= 2 },
  // 3 — режим покупки
  { target: () => ({ kind: 'buy-mode' }), show: (c) => onJobs(c) && (job(c, FIRST)?.level ?? 0) >= 4,
    done: (c) => (job(c, SECOND)?.level ?? 0) >= 1, needsAck: true },
  // 4 — открыть работу 2
  { target: () => ({ kind: 'job-unlock', jobId: SECOND }), show: (c) => onJobs(c) && c.engine.canUnlock(SECOND),
    done: (c) => (job(c, SECOND)?.level ?? 0) >= 1 },
  // 5 — повышение (только когда хватает денег, иначе кнопка выключена, а всё остальное заблокировано)
  { target: (c) => ({ kind: 'job-panel', jobId: promotable(c) ?? FIRST }),
    show: (c) => onJobs(c) && promotable(c) !== undefined,
    done: (c) => anyJob(c, (id) => (job(c, id)?.rank ?? 0) > 0) },
  // 6 — найм менеджера: «Нажми Меню» → «Менеджеры» → «Нанять»; цель — по текущему экрану
  { target: (c) => c.route === 'managers' ? { kind: 'manager-hire', jobId: hireable(c) ?? FIRST }
      : c.route === 'menu' ? { kind: 'menu-managers' } : { kind: 'menu' },
    textKey: (c) => c.route === 'managers' ? 'tutorial.8' : c.route === 'menu' ? 'tutorial.7' : 'tutorial.6',
    show: (c) => hireable(c) !== undefined && ['jobs', 'menu', 'managers'].includes(c.route),
    done: hasManager },
  // 7 — итог
  { target: () => ({ kind: 'none' }), textKey: () => 'tutorial.9', show: () => true, done: () => false, needsAck: true },
]

/** Пропускает все шаги, условие которых уже выполнено; после последнего — tutorialDone. */
export function tutorialAdvance(engine: GameEngine, route: string, buyMode: BuyMode = 'one'): void {
  const ui = engine.state.ui
  if (!ui.tutorialDone && ui.tutorialStep >= STEPS.length) finish(engine)
  while (!ui.tutorialDone && STEPS[ui.tutorialStep]?.done({ engine, route, buyMode })) next(engine)
}

/** «Понятно» на шаге, который ждёт подтверждения. */
export function tutorialAck(engine: GameEngine, route: string, buyMode: BuyMode = 'one'): void {
  const ui = engine.state.ui
  if (ui.tutorialDone || !STEPS[ui.tutorialStep]?.needsAck) return
  next(engine)
  tutorialAdvance(engine, route, buyMode)
}

/** Что показать сейчас; null — обучение пройдено или текущий шаг ещё ждёт своего момента. */
export function tutorialView(engine: GameEngine, route: string, buyMode: BuyMode = 'one'): TutorialView | null {
  const ui = engine.state.ui
  const step = STEPS[ui.tutorialStep]
  if (ui.tutorialDone || !step) return null
  const ctx = { engine, route, buyMode }
  if (!step.show(ctx)) return null
  const textKey = step.textKey?.(ctx) ?? `tutorial.${ui.tutorialStep}`
  return { step: ui.tutorialStep, textKey, target: step.target(ctx), needsAck: !!step.needsAck }
}

function next(engine: GameEngine): void {
  engine.state.ui.tutorialStep += 1
  if (engine.state.ui.tutorialStep >= STEPS.length) finish(engine)
}

function finish(engine: GameEngine): void {
  const ui = engine.state.ui
  ui.tutorialDone = true
  ui.tutorialStep = STEPS.length
  // итог обучения уже рассказал про менеджеров — подсказку раздела не повторяем
  if (!ui.hintsSeen.includes('managers')) ui.hintsSeen.push('managers')
}
