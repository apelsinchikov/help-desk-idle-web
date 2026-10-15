# Веб / Telegram Mini App — этап 1 «Ядро» (дизайн)

Дата: 2026-10-15 · Ветка: `dev` · Статус: на ревью у автора

## Цель
Этап 1 iOS-версии (см. `GAME_DESIGN.md` → «Этапы», п. 1) как Telegram Mini App. Все игроки — через Telegram; обычный браузер — только для разработки (без облака):
12 работ, тап-старт / тап-сбор, покупка ×1/×10/×100/Max, достижения (порог → эффект), менеджеры за деньги,
оффлайн-доход + «С возвращением», экран загрузки, сохранение (локально + Supabase), RU/EN, тема A.

**Готово, когда:**
1. Ядро на TS даёт те же числа, что Swift: тесты (`node --test`) повторяют `Packages/HelpDeskCore/Tests` с теми же входами и ожиданиями.
2. В Telegram прогресс общий для всех устройств одного Telegram-аккаунта (телефон, десктоп).
3. Игра работает без сети; облако — бэкап.
4. Автор проверил на телефоне и десктопе в Telegram.

**Вне этапа:** всё из этапов 2–4, тёмная тема, перенос прогресса между iOS и вебом, платежи.

## Принятые решения
| Вопрос | Решение |
|---|---|
| Хостинг | GitHub Pages (репо публичный), деплой GitHub Actions при пуше в `dev` и `main` (на время проверки бот смотрит на `dev`) |
| UI | Vite + TypeScript + Preact + `@preact/signals` |
| Тесты | встроенный `node --test` (Node 22, без зависимостей — ядро проверяется где угодно) |
| Supabase | **Отдельный новый проект**; схема `game_saves` — та же миграция, без изменений |
| Вход в Telegram | `initData` → Edge Function `telegram-auth` → сессия Supabase по Telegram ID |
| Вне Telegram | Только локальный сейв, облако выключено (режим разработки). Анонимного входа нет |
| Формат сейва | Свой, совместимость с iOS-сейвами не нужна |
| Бот | новый, создаётся через BotFather (инструкция — шаг 10 плана) |

## Структура
```
web/
  index.html, vite.config.ts, tsconfig.json, package.json, .env.example
  src/core/          порт HelpDeskCore 1:1, без DOM и без Preact
    content.ts       JobDefinition, Milestone, GameConfig, GameContent (сортировка по order, job/previousJob)
    economy.ts       nextCost, bulkCost, maxAffordable, payout, cycle
    milestones.ts    speedMultiplier, profitMultiplier, nextMilestone
    format.ts        formatMoney, formatDuration, AppLanguage
    state.ts         GameState, JobState, PlayerSettings, BuyMode, JobStatus, newGame()
    engine.ts        GameEngine: status, tap, quote, buy, unlock, hireManager, advance, resume, reset, replaceState
    savePicker.ts    pick(local, remote)
    serialize.ts     GameState ⇄ JSON, проверка schemaVersion
    *.test.ts
  src/platform/
    telegram.ts      обёртка над window.Telegram.WebApp: isTelegram, initData, ready/expand, safe area, BackButton, haptics
    storage.ts       localStorage: save + save.prev (аналог LocalSaveStore)
    cloud.ts         supabase-js: вход по Telegram, upload, download(timeout); вне Telegram — отключён
  src/app/
    store.ts         signals поверх GameEngine, тик, автосейв, жизненный цикл (visibilitychange/pagehide)
    i18n.ts          строки из Localizable.xcstrings, t(key, args), переключение языка
    icons.ts         IconProvider: iconKey → URL картинки
  src/ui/            Loading, Jobs (Header, JobCard, LockedJobCard, ProgressBar), Menu, Managers, Settings, WelcomeBack
  src/theme/         tokens.css (значения из Theme.swift), шрифты Manrope/Unbounded
supabase/functions/telegram-auth/index.ts
.github/workflows/pages.yml
```

**Общие файлы не копируются** — Vite импортирует их из iOS-части репо:
- баланс: `Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/{jobs,milestones,config}.json`;
- строки: `HelpDeskIdle/HelpDeskIdle/Localization/Localizable.xcstrings` (это JSON);
- иконки: `HelpDeskIdle/HelpDeskIdle/Assets.xcassets/Icons/fluent3d_<key>.imageset/*.png`;
- шрифты: `HelpDeskIdle/HelpDeskIdle/Fonts/*.ttf`.
`vite.config.ts` разрешает чтение за пределами `web/` (`server.fs.allow: ['..']`).

## Ядро (порт 1:1)
- Формулы — ровно как в `Economy.swift` / `MilestoneMath.swift` (Pecorella Part I), включая поправку `maxAffordable` (±3 шага и деление пополам). Числа баланса — только из JSON.
- `Date` → миллисекунды (`number`) внутри ядра; часы передаются функцией `now()`, чтобы тесты управляли временем.
- Механика сбора как в iOS: без менеджера `idle → tap → running → ready → tap (сбор) → idle`; менеджер стартует сам и собирает в `advance`; при цикле < `fastCycleThreshold` у работы с менеджером — `streaming`.
- Оффлайн: `resume(now)` — при отсутствии < 60 с просто `advance`, иначе `advance` с лимитом `offlineCapHours` и `OfflineReport { elapsed, earned, readyJobs }`.
- Форматирование: `GameNumberFormatter` / `GameDurationFormatter` повторяются посимвольно (NBSP как разделитель групп в RU, «млн/million», дальше `aa, ab…`).
- `engine` — обычный класс без зависимостей от UI; реактивность добавляет `src/app/store.ts`: после каждого действия и тика кладёт новый снимок состояния в signal.

## Сейв
- Формат `GameState` — свой (с iOS-сейвами не совместим и не должен): `schemaVersion, money, lifetimeEarnings, jobs{id:{level,hasManager,startedAt}}, lastActiveAt, settings{language,haptics}`. Даты — миллисекунды Unix (`number`), `startedAt: null` — работа стоит; `schemaVersion = 1`.
- Локально: `localStorage['hdi.save']`, перед записью прошлая валидная копия → `hdi.save.prev`. Битый или «из будущего» сейв → пробуем prev → иначе новая игра.
- Когда пишем: после каждой покупки/найма/открытия, каждые `autosaveSeconds` (30 с), на `visibilitychange: hidden` и `pagehide`, на событии закрытия Mini App.
- Облако: таблица `public.game_saves` (одна строка на `auth.uid()`), upsert при каждом локальном сохранении, но не чаще раза в 30 с + принудительно при уходе в фон.
- Старт: показываем загрузку → локальный сейв → (в Telegram) вход + `download` с таймаутом 4 с → `SavePicker.pick` (больше `lifetimeEarnings`, при равенстве свежее `lastActiveAt`) → `resume` → «С возвращением», если есть отчёт.
- Ошибки облака не блокируют игру: статус в Настройках («сохранено в облаке · время» / «нет связи»), повтор при следующем сохранении.

## Вход
**Telegram** (`Telegram.WebApp.initData` не пустая):
1. Клиент → `POST /functions/v1/telegram-auth` с `{ initData }`.
2. Функция: проверяет подпись (`secret = HMAC_SHA256("WebAppData", BOT_TOKEN)`, `hash = HMAC_SHA256(secret, data_check_string)`), отклоняет `auth_date` старше 24 ч.
3. `admin.createUser` с email `tg<telegram_id>@telegram.local` (служебный адрес, писем не шлём), `email_confirm: true`, `app_metadata.telegram_id`; ошибку «email уже существует» игнорирует — значит, игрок уже есть (поиск по списку пользователей не нужен).
4. `admin.generateLink({ type: 'magiclink' })` → `verifyOtp({ token_hash, type: 'magiclink' })` → возвращает `{ access_token, refresh_token }`.
5. Клиент: `supabase.auth.setSession(...)`. Дальше обычный supabase-js с RLS.
Секреты функции: `TELEGRAM_BOT_TOKEN` (задан автором); `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет сам. Функция деплоится с `verify_jwt = false` (вызывается до входа).

**Вне Telegram:** входа нет, облако выключено, в Настройках «Облако: только в Telegram». Нужно для `npm run dev` и быстрой проверки в браузере.

## Конфигурация
- `web/.env.local` (в `.gitignore`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. В репо — `web/.env.example`.
- GitHub Actions secrets с теми же именами (заданы автором). Нет ключей → игра работает только локально.
- `vite.config.ts`: `base: '/help-desk-idle-web/'`.

## UI
- Экраны и поведение — как в iOS (`HelpDeskIdle/HelpDeskIdle/Features/*`) и макетах темы A; цвета только через CSS-переменные из `tokens.css`.
- Полоска прогресса рисуется в `requestAnimationFrame` из `startedAt` и `cycle` (без перерисовки всего списка); логика — тик ~10 Гц.
- Telegram: `ready()` + `expand()`, `disableVerticalSwipes()` (чтобы свайп по списку не закрывал приложение), отступы по `safeAreaInset`/`contentSafeAreaInset`, BackButton закрывает Меню/Менеджеров/Настройки, хаптик при сборе/покупке (если включён в Настройках). Цвета Telegram не используем — у игры своя тема.
- Язык: при первом запуске из `Telegram.WebApp.initDataUnsafe.user.language_code` или `navigator.language` (`ru*` → RU, иначе EN); дальше — переключатель в Настройках.

## Тесты
- `node --test` на всё `src/core/`: перенос кейсов `EconomyTests, FormattingTests, GameEngineTests, OfflineTests, SavePickerTests, StateTests, ContentTests` с теми же числами; `LocalSaveStoreTests` → тесты `storage.ts` на фейковом localStorage.
- Edge Function: юнит-тест проверки подписи на заранее посчитанном примере.
- UI — ручная проверка автором.

## Риски
- Telegram WebView может чистить localStorage — поэтому облако обязательно в Telegram; вход по Telegram ID восстанавливает прогресс.
- `generateLink + verifyOtp` создаёт сессию через служебный email; при смене подхода Supabase к выдаче сессий — переход на кастомный JWT.
- Доступ к файлам вне `web/` в Vite — только чтение на сборке; в итоговый `dist/` попадают лишь использованные ассеты.
