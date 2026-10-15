# Веб / Telegram Mini App — этап 1 «Ядро»: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Help Desk Idle этапа 1 как Telegram Mini App в `web/`, сейв локально + отдельный проект Supabase с входом по Telegram ID.

**Architecture:** `web/src/core` — чистый TS-порт HelpDeskCore без зависимостей (тесты на встроенном `node --test`, те же числа, что в Swift). `web/src/app` связывает ядро с Preact-signals, сейвом и облаком; `web/src/ui` — экраны по iOS-версии; `web/src/platform` — Telegram SDK, localStorage, supabase-js. Вход — Edge Function `telegram-auth`. Деплой — GitHub Pages через Actions.

**Tech Stack:** Node 22, TypeScript 5.8+, Vite, Preact + `@preact/signals`, `@supabase/supabase-js@2`, `node:test`, Supabase Edge Functions (Deno), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-15-web-telegram-stage1-design.md`

## Global Constraints
- Баланс только из `Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/{jobs,milestones,config}.json` — импорт, не копия; никаких чисел баланса в коде.
- Строки UI только через `t()` из `Localizable.xcstrings`; новые ключи — в тот же `.xcstrings` (ru + en). Захардкоженных строк в UI нет.
- Цвета только CSS-переменные из `web/src/theme/tokens.css` (значения = `ThemeTokens.officeA` из `Theme.swift`).
- Иконки только через `iconUrl(iconKey)`.
- Прогресс работы — из `startedAt` и `cycle`, не тиками. Время в ядре — миллисекунды Unix (`number`), длительности — секунды.
- Механика сбора: без менеджера старт только тапом; `ready` → тап собирает и работа встаёт (`startedAt = null`); менеджер стартует и собирает сам; уровни покупает только игрок.
- `src/core/**` и `src/app/{saveScheduler,timeout}.ts` не импортируют ничего, кроме друг друга и JSON (`with { type: 'json' }`); импорты с расширением `.ts`; без `enum`/`namespace`/parameter properties (запуск через type stripping Node 22).
- Облако только в Telegram (`initData` не пустая); вне Telegram — локальный сейв, облако `disabled`.
- Ключи: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`web/.env.local`, GitHub Actions secrets). Токен бота — только секрет `TELEGRAM_BOT_TOKEN` функции.
- Git: ветка `dev`; Conventional Commits на английском; автор `Evgeniy <evgenyassylov@gmail.com>`; **без** `Co-Authored-By`, ссылок на сессии и упоминаний ассистента.
- `HelpDeskIdle/` и `Packages/` — только чтение (кроме добавления строк в `Localizable.xcstrings`).
- Файлы ≤ ~300 строк.

## Окружение исполнения (важно)
- В сессии нет доступа к npm-реестру ни в облаке, ни в shell мака. Поэтому:
  - ядро и его тесты — без npm: `node --test` на Node 22 (shell мака, `device_bash`, Node v22.23 там есть);
  - `npm install`, `npm run dev`, `npm run build` запускает **автор** в Терминале мака (нужен Node ≥ 22: `node -v`, иначе `brew install node`); lock-файл коммитим;
  - сборка и тесты ещё раз прогоняются в GitHub Actions при пуше.
- `git push` делает автор (из shell сессии GitHub недоступен).
- Проверка UI: автор запускает `npm run dev`, ассистент смотрит `http://localhost:5173/help-desk-idle-web/` во встроенном браузере (или автор присылает скриншот).

## Review Focus
1. localStorage недоступен / переполнен / битый сейв → игра всё равно стартует (новая игра или prev-копия) — тест в Task 5.
2. Mini App закрыт резко, без `visibilitychange` → потеря не больше одного автосейв-интервала, а покупки сохраняются сразу — тест в Task 6.
3. Нет сети или Supabase висит при старте → экран загрузки уходит не позже 4 с, игра локальная — тест `withTimeout` в Task 6.
4. Облачный `payload` из будущей схемы или битый → игнорируется, не роняет игру — тест `decodeState` в Task 3.
5. Часы устройства переведены назад / вперёд на месяц → нет отрицательного прогресса и денег сверх лимита 24 ч — тесты в Task 4.

---

### Task 1: Каркас `web/` и загрузка контента

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/.env.example`, `web/src/main.tsx` (заглушка «Help Desk Idle»), `web/src/core/content.ts`, `web/src/core/bundled.ts`, `web/src/core/content.test.ts`
- Modify: `.gitignore` (+ `web/node_modules/`, `web/dist/`, `web/.env.local`)

**Interfaces:**
- Produces:
  - `type JobDefinition = { id: string; order: number; baseCost: number; growthRate: number; time: number; revenue: number; unlockLevel: number; managerCost: number; iconKey: string }`
  - `type MilestoneEffect = 'speed' | 'profit'`; `type Milestone = { jobId: string | null; level: number; effect: MilestoneEffect; value: number }`
  - `type GameConfig = { offlineCapHours: number; autosaveSeconds: number; fastCycleThreshold: number }`
  - `class GameContent { readonly jobs: JobDefinition[] /* sorted by order */; readonly milestones: Milestone[]; readonly config: GameConfig; constructor(jobs, milestones, config); job(id: string): JobDefinition | undefined; previousJob(id: string): JobDefinition | undefined }`
  - `bundled.ts`: `export const bundledContent: GameContent` (JSON из `../../../Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/*.json` через `with { type: 'json' }`)

- [ ] **Step 1: package.json / tsconfig / vite.config**
  - scripts: `"test": "node --test \"src/**/*.test.ts\" \"../supabase/functions/**/*.test.ts\""`, `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`.
  - deps: `preact`, `@preact/signals`, `@supabase/supabase-js@^2`; devDeps: `vite`, `@preact/preset-vite`, `typescript@^5.8`, `@types/node`.
  - tsconfig: `strict`, `module: "esnext"`, `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `noEmit`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `resolveJsonModule`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `types: ["vite/client", "node"]`.
  - vite: `base: '/help-desk-idle-web/'`, plugin `preact()`, `server.fs.allow: ['..']`.
  - `.env.example`: `VITE_SUPABASE_URL=` и `VITE_SUPABASE_PUBLISHABLE_KEY=`.
- [ ] **Step 2: тест `content.test.ts`** (порт `ContentTests`)
  ```ts
  test('bundled content has 12 jobs in order', () => {
    const c = bundledContent
    assert.equal(c.jobs.length, 12)
    assert.equal(c.jobs[0].id, 'reboot'); assert.equal(c.jobs.at(-1)!.id, 'ddos_rivals')
    assert.equal(c.job('plug_mouse')!.baseCost, 60); assert.equal(c.job('ddos_rivals')!.time, 36864)
    assert.equal(c.previousJob('plug_mouse')!.id, 'reboot'); assert.equal(c.previousJob('reboot'), undefined)
    assert.equal(c.config.offlineCapHours, 24)
  })
  test('every job has a level-25 milestone', /* как testMilestonesCoverEveryJob */)
  ```
- [ ] **Step 3:** `cd web && node --test "src/**/*.test.ts"` → FAIL (модуля нет).
- [ ] **Step 4:** реализовать `content.ts`, `bundled.ts`.
- [ ] **Step 5:** тот же запуск → PASS.
- [ ] **Step 6 (автор):** `cd web && npm install && npm run build` → `dist/` собран без ошибок; `npm run dev` показывает заглушку.
- [ ] **Step 7: Commit** — `chore(web): vite + preact scaffold, bundled content` (вместе с `package-lock.json`).

### Task 2: Экономика, milestones, форматирование

**Files:** Create `web/src/core/economy.ts`, `milestones.ts`, `format.ts`, `economy.test.ts`, `format.test.ts`

**Interfaces:**
- Consumes: `Milestone` (Task 1)
- Produces:
  - `nextCost(base, rate, owned): number`, `bulkCost(base, rate, owned, count): number`, `maxAffordable(base, rate, owned, money): number`, `payout(revenue, level, profitMultiplier): number`, `cycle(time, speedMultiplier): number`
  - `speedMultiplier(jobId, levels: Record<string, number>, milestones): number`, `profitMultiplier(...)`, `nextMilestone(jobId, level, milestones): Milestone | undefined`
  - `type AppLanguage = 'ru' | 'en'`; `formatMoney(value: number, lang): string`; `formatDuration(seconds: number, lang): string`

- [ ] **Step 1: тесты** — 1:1 из `EconomyTests.swift` и `FormattingTests.swift` (все значения оттуда; `accuracy` → `Math.abs(a-b) < eps`). Ключевые:
  ```ts
  near(nextCost(4, 1.07, 10), 7.87, 0.01); near(bulkCost(4, 1.07, 0, 10), 55.27, 0.01)
  assert.equal(maxAffordable(4, 1.07, 0, 55.27), 10); assert.equal(maxAffordable(4, 1.07, 0, 55.26), 9)
  // сетка money × owned для (60, 1.15): bulkCost(n) <= money
  assert.equal(speedMultiplier('reboot', {...all0, reboot: 112}, ms), 8)  // затем все ≥25 → 16, plug_mouse → 4
  assert.equal(nextMilestone('plug_mouse', 64, ms)!.level, 100)
  assert.equal(formatMoney(186_420, 'ru'), '186 420'); assert.equal(formatMoney(999_950_000, 'ru'), '1 млрд')
  assert.equal(formatMoney(1e21, 'ru'), '1 aa'); assert.equal(formatDuration(1.5, 'ru'), '1,5 с'); assert.equal(formatDuration(-5, 'ru'), '0 с')
  ```
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** реализовать, повторяя `Economy.swift`, `MilestoneMath.swift`, `GameNumberFormatter.swift`, `GameDurationFormatter.swift` построчно (`maxAffordable`: ±3 шага коррекции, потолок 1 000 000, деление пополам; `cycle` делит на `max(S, Number.MIN_VALUE)`; `%.Nf` → `toFixed(N)`).
- [ ] **Step 4:** запуск → PASS.
- [ ] **Step 5: Commit** — `feat(web-core): economy, milestones and number/duration formatting`.

### Task 3: Состояние, сериализация, выбор сейва

**Files:** Create `web/src/core/state.ts`, `serialize.ts`, `savePicker.ts`, `state.test.ts`, `savePicker.test.ts`

**Interfaces:**
- Produces:
  - `type JobState = { level: number; hasManager: boolean; startedAt: number | null }`
  - `type PlayerSettings = { language: AppLanguage; haptics: boolean }`
  - `type GameState = { schemaVersion: number; money: number; lifetimeEarnings: number; jobs: Record<string, JobState>; lastActiveAt: number; settings: PlayerSettings }`
  - `const CURRENT_SCHEMA = 1`; `newGame(content, now: number, language: AppLanguage): GameState` (первая работа level 1, остальные 0, `haptics: true`)
  - `type BuyMode = 'one' | 'ten' | 'hundred' | 'max'`; `nextBuyMode(m: BuyMode): BuyMode`
  - `type JobStatus = { kind: 'locked'; requirementMet: boolean } | { kind: 'idle' } | { kind: 'running'; progress: number; remaining: number } | { kind: 'ready' } | { kind: 'streaming'; perSecond: number }`
  - `type OfflineReport = { elapsed: number /*s*/; earned: number; readyJobs: number }`
  - `encodeState(s: GameState): string`; `decodeState(raw: unknown): GameState | null` (принимает строку или уже распарсенный объект)
  - `pickSave(local: GameState | null, remote: GameState | null): GameState | null`

- [ ] **Step 1: тесты** — `StateTests` (newGame: reboot=1, plug_mouse=0, 12 работ, money 0; round-trip encode→decode равен исходному при `startedAt` = 42 000; `nextBuyMode('one') === 'ten'`, `nextBuyMode('max') === 'one'`), `SavePickerTests` (больше lifetime побеждает в обе стороны; ничья → больший `lastActiveAt`; null-стороны). Плюс Review Focus #4:
  ```ts
  assert.equal(decodeState('{not json'), null)
  assert.equal(decodeState({ ...valid, schemaVersion: 2 }), null)
  assert.equal(decodeState({ ...valid, money: 'x' }), null)
  assert.equal(decodeState({ ...valid, jobs: { reboot: { level: -1, hasManager: false, startedAt: null } } }), null)
  ```
- [ ] **Step 2:** FAIL → **Step 3:** реализовать (`decodeState` проверяет типы всех полей, конечные числа, `level` — целое ≥ 0, `language ∈ {ru,en}`) → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(web-core): game state, serialization and save picker`.

### Task 4: GameEngine и оффлайн

**Files:** Create `web/src/core/engine.ts`, `engine.test.ts`, `offline.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `class GameEngine`:
  - `constructor(content: GameContent, state: GameState, now: () => number = Date.now)`
  - `get state(): GameState` (мутируется движком; UI читает после `version`-сигнала из Task 6)
  - `level(id)`, `cycle(id): number /*s*/`, `payout(id)`, `nextMilestone(id)`, `get incomePerSecond(): number`, `status(id): JobStatus`
  - `tap(id): void`, `quote(id, mode: BuyMode): { count: number; cost: number }`, `buy(id, mode): boolean`, `canUnlock(id)`, `unlock(id): boolean`, `canHireManager(id)`, `hireManager(id): boolean`
  - `advance(now: number, capSeconds?: number): number`, `resume(now: number): OfflineReport | null`, `reset(now: number): void`, `replaceState(s: GameState): void`, `updateSettings(patch: Partial<PlayerSettings>): void`

- [ ] **Step 1: тесты** — все кейсы `GameEngineTests.swift` и `OfflineTests.swift` с теми же числами; время `t = 0` мс, шаги в мс (`t += 600` вместо `+0.6`). Ключевые ожидания: сбор 1 → money 1, после сбора `idle` и через 5 с всё ещё `idle`; buy ×1 при 100 → money `100 - 4.28`; unlock plug_mouse при reboot 25 → money `1e6 - 60`; менеджер reboot lvl10 за 6 с → `10 * Math.floor(6 / 0.6)`; lvl 300 с менеджером → `cycle = 0.6 / 32`, `streaming`, за 10 с `300 * Math.floor(10 / cycle)`; часы назад на час → `advance` даёт 0, progress ∈ [0,1]; оффлайн 2 ч → `10 * Math.floor(7200 / 0.6)`; 30 дней → кап `10 * Math.floor(86400 / 0.6)`, `elapsed = 30*86400`; без менеджера → `readyJobs 1, earned 0`; отсутствие 30 с и часы назад → `null`.
- [ ] **Step 2:** FAIL → **Step 3:** реализовать, повторяя `GameEngine.swift` (секунды = `(now - startedAt) / 1000`; `levels` — уровни ВСЕХ работ, закрытые = 0) → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(web-core): game engine with tap/collect, buying, managers and offline`.

### Task 5: Локальный сейв

**Files:** Create `web/src/platform/storage.ts`, `storage.test.ts`

**Interfaces:**
- Consumes: `encodeState`, `decodeState`.
- Produces: `type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`; `createLocalSave(storage?: KeyValueStorage /* по умолчанию localStorage, если доступен */): { load(): GameState | null; save(s: GameState): void }`. Ключи `hdi.save`, `hdi.save.prev`.

- [ ] **Step 1: тесты** (на Map-фейке): save→load = то же; второй save переносит прошлую валидную копию в prev; битый `hdi.save` → load берёт prev; оба битые → null; **Review Focus #1:** storage, у которого `getItem`/`setItem` бросают, → `load()` = null, `save()` не бросает; `createLocalSave()` без глобального `localStorage` → работает как пустой.
- [ ] **Step 2:** FAIL → **Step 3:** реализовать → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(web): local save with backup copy`.

### Task 6: Планировщик сохранений, таймаут, store на signals

**Files:** Create `web/src/app/saveScheduler.ts`, `web/src/app/timeout.ts`, `web/src/app/saveScheduler.test.ts`, `web/src/app/timeout.test.ts`, `web/src/app/store.ts`

**Interfaces:**
- Produces:
  - `withTimeout<T>(p: Promise<T>, ms: number): Promise<T>` — reject `Error('timeout')` по истечении.
  - `createSaveScheduler(o: { saveLocal(): void; uploadCloud(): Promise<void>; localIntervalMs: number; cloudIntervalMs: number; now: () => number }): { changed(kind: 'purchase' | 'tick'): void; flush(): Promise<void> }` — `purchase` → `saveLocal` сразу; `tick` → `saveLocal`, если прошло ≥ `localIntervalMs`; облако не чаще `cloudIntervalMs`, кроме `flush()` (локально + облако принудительно); ошибка `uploadCloud` проглатывается.
  - `store.ts`: `createGame(o: { engine: GameEngine; scheduler; cloudStatus: Signal<CloudStatus> })` → `{ engine; version: Signal<number>; buyMode: Signal<BuyMode>; offlineReport: Signal<OfflineReport | null>; route: Signal<'jobs' | 'menu' | 'managers' | 'settings'>; act(kind: 'purchase' | 'tap', fn: () => void): void; startTicking(): void; stopTicking(): void; onHidden(): Promise<void>; onVisible(): void }`. Тик 100 мс: `engine.advance(Date.now())`, `version++`, `scheduler.changed('tick')`. `onVisible` → `engine.resume` → при отчёте `offlineReport.value = report`.
  - `type CloudStatus = { kind: 'disabled' } | { kind: 'syncing' } | { kind: 'synced'; at: number } | { kind: 'offline' }` (в `store.ts`).
- [ ] **Step 1: тесты** — scheduler (Review Focus #2): `purchase` пишет сразу; 3 тика за 10 с при интервале 30 с → 0 записей, тик на 30-й секунде → 1 запись; облако дважды подряд → 1 выгрузка; `flush()` → выгрузка независимо от интервала; `uploadCloud` reject → `flush()` резолвится. timeout (Review Focus #3): никогда не резолвящийся промис + 50 мс → reject `timeout`; быстрый промис → значение.
- [ ] **Step 2:** FAIL → **Step 3:** реализовать `saveScheduler.ts`, `timeout.ts`, затем `store.ts` (без тестов, интерфейс выше; `localIntervalMs = config.autosaveSeconds*1000`, `cloudIntervalMs = 30000`) → **Step 4:** PASS + `npm run build` у автора без ошибок типов.
- [ ] **Step 5: Commit** — `feat(web): save scheduler and signals store`.

### Task 7: Тема, i18n, иконки

**Files:** Create `web/src/theme/tokens.css`, `web/src/theme/fonts.css`, `web/src/app/i18n.ts`, `web/src/app/i18n.test.ts`, `web/src/app/icons.ts`

**Interfaces:**
- Produces:
  - `tokens.css`: `:root { --background:#F3EFE6; --card:#FFFFFF; --ink:#1D1B16; --muted:#6B655A; --line:#E2DACB; --track:#EEE7D8; --track-strong:#E7E0D2; --locked-border:#CFC6B4; --accent:#2350D8; --accent-dark:#163A9E; --amber:#F5B82E; --positive:#1E7A3C; --on-accent:#FFFFFF; --managers:#3B7DD8; --achievements:#E0A21B; --upgrades:#E2572B; --reorg:#8A4FC7; --wardrobe:#C2417A; --shop:#B4461A; --night:#1D2440; --night-accent:#8FB0FF; --night-muted:#D6DDF2 }`
  - `fonts.css`: `@font-face` Manrope и Unbounded из `../../../HelpDeskIdle/HelpDeskIdle/Fonts/*.ttf`.
  - `parseXcstrings(json: unknown): Record<AppLanguage, Record<string, string>>`; `formatString(template: string, args: (string | number)[]): string` (поддержка `%@`, `%lld`, `%d`, `%1$@`/`%2$lld`, `%%`); `createI18n(tables, language: Signal<AppLanguage>)` → `t(key: string, ...args): string` (фолбэк: другой язык → сам ключ); `detectLanguage(code: string | undefined): AppLanguage` (`ru*` → ru, иначе en).
  - `iconUrl(iconKey: string): string` — `import.meta.glob('../../../HelpDeskIdle/HelpDeskIdle/Assets.xcassets/Icons/fluent3d_*.imageset/*.png', { eager: true, query: '?url', import: 'default' })`; нет иконки → `''` (UI рисует пустую плашку).
- [ ] **Step 1: тесты** `i18n.test.ts` (только `parseXcstrings`, `formatString`, `detectLanguage` — они чистые): `buy.button` en → `'Buy ×%lld'`, `formatString('Buy ×%lld', [10]) === 'Buy ×10'`, `formatString('%2$@ — %1$@', ['a','b']) === 'b — a'`, `'100%%'` → `'100%'`, ключ без локализаций (`'%lld'`) пропускается; `detectLanguage('ru-RU') === 'ru'`, `detectLanguage(undefined) === 'en'`.
- [ ] **Step 2:** FAIL → **Step 3:** реализовать (`i18n.ts` держит чистые функции отдельно от сигналов, чтобы тест не тянул npm) → **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(web): theme tokens, fonts, i18n from xcstrings, icon provider`.

### Task 8: Главный экран

**Files:** Create `web/src/ui/App.tsx`, `ui/Loading.tsx`, `ui/jobs/JobsScreen.tsx`, `ui/jobs/Header.tsx`, `ui/jobs/JobCard.tsx`, `ui/jobs/LockedJobCard.tsx`, `ui/jobs/ProgressBar.tsx`, `ui/styles.css`; Modify `web/src/main.tsx`

**Interfaces:**
- Consumes: `createGame` (Task 6), `t`, `iconUrl`, `formatMoney/formatDuration`, `GameEngine`.
- Produces: `<App game={...} />`; экраны берут данные только из `engine` после чтения `game.version.value`.

- [ ] **Step 1:** перенести поведение iOS (`Features/Jobs/*`, `Features/Loading/LoadingScreen.swift`): шапка (баланс, доход/сек, переключатель ×1/×10/×100/Max через `nextBuyMode`), карточка — вся зона тапа (`game.act('tap', () => engine.tap(id))`), состояния idle / running / ready (пульс) / streaming («$X / сек»), кнопка покупки с `quote`, «Нужно: <работа> ур. 25 · Открыть за $X» на закрытой; загрузка не короче 1,4 с с шуточными статусами из `.xcstrings`.
- [ ] **Step 2:** `ProgressBar` — свой `requestAnimationFrame`, ширина из `startedAt`/`cycle` через ref (без ре-рендера списка).
- [ ] **Step 3:** `main.tsx` — `bundledContent` → `createLocalSave().load() ?? newGame(...)` → `GameEngine` → `createGame` → `render(<App/>)`; `visibilitychange`/`pagehide` → `onHidden()` / `onVisible()`.
- [ ] **Step 4 (проверка):** автор `npm run dev`; в браузере: тап → полоска → «Готово — собрать» → тап → деньги +1, работа стоит; покупка ×1/Max; обновление страницы сохраняет прогресс. Скриншот на 390×844.
- [ ] **Step 5: Commit** — `feat(web-ui): jobs screen, header, progress bar, loading`.

### Task 9: Меню, Менеджеры, Настройки, «С возвращением»

**Files:** Create `web/src/ui/Menu.tsx`, `ui/Managers.tsx`, `ui/Settings.tsx`, `ui/WelcomeBack.tsx`; Modify `ui/App.tsx`

- [ ] **Step 1:** по `Features/{Menu,Managers,Settings,Offline}/*.swift`: меню-лист (Менеджеры, Настройки; остальные разделы этапов 2–4 не показываем), список менеджеров с ценой/наймом (`act('purchase', …)`), бейдж числа доступных; Настройки: язык RU/EN (`updateSettings` + сигнал языка), вибро, статус облака (`cloud.disabled` → новый ключ `cloud.telegramOnly` «только в Telegram» / «Telegram only»), сброс прогресса с подтверждением в UI (не `confirm()`); WelcomeBack: сколько не было (`formatDuration`), заработано, кнопка «Забрать».
- [ ] **Step 2:** новые ключи — в `Localizable.xcstrings` (ru + en).
- [ ] **Step 3 (проверка):** найм менеджера → работа крутится сама; переключение языка меняет все строки и формат чисел; вкладка в фоне 2 мин → «С возвращением».
- [ ] **Step 4: Commit** — `feat(web-ui): menu, managers, settings, welcome back`.

### Task 10: Telegram-платформа

**Files:** Create `web/src/platform/telegram.ts`; Modify `web/index.html`, `web/src/main.tsx`, `web/src/ui/App.tsx`

**Interfaces:**
- Produces: `telegram: { isTelegram: boolean; initData: string; languageCode?: string; init(): void /* ready, expand, disableVerticalSwipes, setHeaderColor('#F3EFE6'), setBackgroundColor */; onBack(cb: (() => void) | null): void /* BackButton show/hide */; haptic(kind: 'light' | 'success'): void; safeArea(): { top: number; bottom: number } }` — всё no-op вне Telegram.

- [ ] **Step 1:** `<script src="https://telegram.org/js/telegram-web-app.js"></script>` в `index.html` до бандла; минимальные типы `window.Telegram.WebApp` в `telegram.ts`.
- [ ] **Step 2:** отступы `--safe-top/--safe-bottom` из `safeAreaInset + contentSafeAreaInset` (+ событие `safeAreaChanged`); BackButton на экранах Меню/Менеджеры/Настройки → `route = 'jobs'`; хаптик при сборе и покупке, если `settings.haptics`; язык новой игры — `detectLanguage(telegram.languageCode ?? navigator.language)`.
- [ ] **Step 3: Commit** — `feat(web): telegram mini app integration`.

### Task 11: Edge Function `telegram-auth`

**Files:** Create `supabase/functions/telegram-auth/verify.ts`, `verify.test.ts`, `index.ts`; Create `supabase/config.toml` (`[functions.telegram-auth] verify_jwt = false`)

**Interfaces:**
- Produces:
  - `verifyInitData(initData: string, botToken: string, nowSec: number, maxAgeSec = 86400): Promise<{ id: number; languageCode?: string } | null>` — WebCrypto (`crypto.subtle`), работает в Node и Deno; `secret = HMAC_SHA256(key="WebAppData", msg=botToken)`, `hash = hex(HMAC_SHA256(key=secret, msg=data_check_string))`, `data_check_string` — все пары кроме `hash`, отсортированы по ключу, `key=value` через `\n`; сравнение хэшей за постоянное время.
  - HTTP: `POST { initData }` → `200 { access_token, refresh_token }` | `401 { error: 'bad_init_data' }` | `500 { error }`; CORS для `https://apelsinchikov.github.io` и `http://localhost:5173`, `OPTIONS` → 204.
- [ ] **Step 1: тест** `verify.test.ts`: строим `initData` с `user={"id":42,"language_code":"ru"}` и `auth_date`, подписываем тестовым токеном через `node:crypto` → `{ id: 42, languageCode: 'ru' }`; изменённое поле → null; неверный токен → null; `auth_date` старше 24 ч → null; нет `hash` → null.
- [ ] **Step 2:** FAIL → **Step 3:** реализовать `verify.ts` → **Step 4:** PASS (`npm test` в `web/` подхватывает).
- [ ] **Step 5:** `index.ts` (Deno, `npm:@supabase/supabase-js@2`): `verifyInitData` → `admin.createUser({ email: \`tg${id}@telegram.local\`, email_confirm: true, app_metadata: { telegram_id: id } })` (ошибка `email_exists` — нормально) → `admin.generateLink({ type: 'magiclink', email })` → клиент с anon-ключом (`SUPABASE_ANON_KEY`) `auth.verifyOtp({ type: 'magiclink', token_hash: properties.hashed_token })` → вернуть токены сессии.
- [ ] **Step 6 (автор, Терминал мака):** `npx supabase login` → `npx supabase functions deploy telegram-auth --project-ref <ref> --no-verify-jwt` (из корня репо). Проверка: `curl -X POST .../functions/v1/telegram-auth -d '{"initData":"x"}'` → `401`.
- [ ] **Step 7: Commit** — `feat(supabase): telegram-auth edge function`.

### Task 12: Облачное сохранение и старт игры

**Files:** Create `web/src/platform/cloud.ts`; Modify `web/src/main.tsx`, `web/src/ui/Settings.tsx`

**Interfaces:**
- Consumes: `telegram.initData`, `withTimeout`, `decodeState`, `encodeState`, `pickSave`, `CloudStatus`.
- Produces: `createCloud(env: { url?: string; key?: string }, initData: string): CloudSync | null` (null без ключей или вне Telegram); `CloudSync = { signIn(): Promise<void>; download(): Promise<GameState | null>; upload(s: GameState): Promise<void> }`. `signIn`: есть живая сессия supabase-js → ничего; иначе `functions.invoke('telegram-auth', { body: { initData } })` → `auth.setSession`. `download` = `select payload … eq user_id … maybeSingle()` → `decodeState(payload)`. `upload` = upsert `{ user_id, payload: JSON-объект состояния, schema_version, lifetime_earnings, updated_at: new Date().toISOString() }`.
- [ ] **Step 1:** старт в `main.tsx`: Loading → локальный сейв → `withTimeout(cloud.signIn().then(cloud.download), 4000)` (ошибка/таймаут → null, статус `offline`) → `pickSave(local, remote)` → `engine.replaceState` → `resume` → игра. Scheduler: `uploadCloud` = `cloud.upload(engine.state)` со статусами `syncing → synced(at) / offline`.
- [ ] **Step 2:** Settings показывает статус (`cloud.synced` со временем / `cloud.offline` / `cloud.syncing` / `cloud.telegramOnly`).
- [ ] **Step 3 (проверка):** `npm run build` у автора без ошибок; полная проверка — в Task 13 внутри Telegram.
- [ ] **Step 4: Commit** — `feat(web): cloud save via supabase with telegram sign-in`.

### Task 13: Деплой, бот, документация

**Files:** Create `.github/workflows/pages.yml`; Modify `docs/WEB_PORT.md`, `docs/ARCHITECTURE.md` (раздел «Веб»), `README.md`

- [ ] **Step 1: workflow** — триггеры `push` в `dev` и `main`, `workflow_dispatch`; `permissions: pages: write, id-token: write, contents: read`; `concurrency: pages`; шаги: checkout → setup-node 22 (cache npm, `web/package-lock.json`) → `npm ci` → `npm test` → `npm run build` с `env` из секретов `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` → `actions/upload-pages-artifact` (`web/dist`) → `actions/deploy-pages`.
- [ ] **Step 2 (автор):** Settings → Environments → `github-pages` → Deployment branches: добавить `dev` (сейчас Pages на этапе проверки деплоится из `dev`; последний пуш в любую из двух веток — то, что видит бот). `git push` → Actions зелёные → открывается `https://apelsinchikov.github.io/help-desk-idle-web/`.
- [ ] **Step 3 (автор, BotFather):** `/mybots` → бот → Bot Settings → Configure Mini App → Enable → URL выше; `/setmenubutton` → тот же URL, текст «Играть»/«Play».
- [ ] **Step 4:** документация: статус и решения в `WEB_PORT.md`, раздел «Веб» в `ARCHITECTURE.md` (структура, команды, как деплоить функцию), строка в `DECISIONS.md` про деплой из `dev`.
- [ ] **Step 5: Commit** — `ci(web): github pages deploy; docs: web architecture`.

### Task 14: Проверка автором и PR
- [ ] Чек-лист (телефон + десктоп Telegram): старт → загрузка → игра; тап/сбор; покупки ×1/×10/×100/Max; открытие 2-й работы; менеджер; закрыть Mini App на 2+ мин → «С возвращением» с доходом от менеджеров; прогресс на телефоне виден на десктопе (после перезапуска); RU/EN; Настройки → «сохранено в …»; авиарежим → игра работает, статус «нет связи».
- [ ] Ассистент: `npm test` зелёный, финальное ревью ветки.
- [ ] PR `dev` → `main` (описание без подписей ассистента).
