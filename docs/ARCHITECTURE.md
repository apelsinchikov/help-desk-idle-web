# Архитектура — Help Desk Idle

## Стек
- Xcode 16+, Swift 6 (strict concurrency где удобно), SwiftUI, iOS 17.0+.
- Состояние: `@Observable` (Observation framework), `@MainActor` для игрового состояния.
- Зависимости (SPM): `supabase-swift` — единственная внешняя.
- Устройства: симулятор Xcode + iPhone 16 Pro Max.

## Структура проекта
```
Packages/HelpDeskCore/            — вся логика, без UI; `swift test` на маке
  Sources/HelpDeskCore/
    Content/      JobDefinition, Milestone, GameConfig, GameContent (загрузка JSON)
    Resources/    jobs.json, milestones.json, config.json — баланс
    Economy/      Economy (формулы Part I), MilestoneMath
    Formatting/   AppLanguage, GameNumberFormatter, GameDurationFormatter
    State/        GameState, JobState, BuyMode, JobStatus
    Engine/       GameEngine (@Observable), OfflineReport
    Persistence/  SaveStore, LocalSaveStore
  Tests/HelpDeskCoreTests/
HelpDeskIdle/HelpDeskIdle.xcodeproj  — iOS-приложение (Xcode 27, синхронизированные папки)
HelpDeskIdle/HelpDeskIdle/           — исходники приложения
  App/ Theme/ Assets/ Localization/ Features/{Jobs,Menu,Managers,Settings,Loading,Offline}/ Cloud/
  Assets.xcassets/Icons/fluent3d/<iconKey>.imageset
Config/Secrets.xcconfig            — (в .gitignore) SUPABASE_URL, SUPABASE_ANON_KEY
supabase/migrations/               — SQL
tools/fetch_assets.sh              — скачивает иконки Fluent 3D и шрифты
```

## Поток данных
`jobs.json` → `ContentLoader` → `[JobDefinition]` (неизменяемые).
`GameState` (сохраняемое): `money`, `lifetimeEarnings`, `jobs: [id: JobState]`, `lastSavedAt`, `schemaVersion`, `settings`.
`JobState`: `level`, `hasManager`, `isRunning`, `startedAt: Date?`.
`GameEngine` держит `GameState`, пересчитывает по тику (~10 Гц через `Task` + `ContinuousClock`), а UI-прогресс рисует сам из `startedAt` в `TimelineView(.animation)` — плавно и без нагрузки на модель.

## Сохранение
- Локально: `GameState` → JSON, запись при каждой покупке, по таймеру (30 с) и при уходе в фон (`scenePhase`).
- Облако (Supabase): анонимный вход (`auth.signInAnonymously()`), позже — привязка Sign in with Apple, чтобы не терять прогресс.
- Таблица `game_saves`: `user_id uuid PK → auth.users`, `payload jsonb`, `schema_version int`, `lifetime_earnings double precision`, `updated_at timestamptz`. RLS: строка доступна только владельцу (`auth.uid() = user_id`).
- Конфликт: побеждает сохранение с бóльшим `lifetimeEarnings`; при равенстве — более свежее `updated_at`.
- Оффлайн-первый: игра всегда работает без сети; облако — бэкап/перенос между устройствами.

## Ассеты
- Иконки работ — Fluent Emoji 3D (MIT, github.com/microsoft/fluentui-emoji), PNG 256px в `Assets.xcassets/Icons/fluent3d/`.
- Вью обращаются только к `IconProvider.image(for: iconKey)`. Смена пака = новая папка + смена `IconProvider.currentPack`. Лицензии — в `Resources/LICENSES.md`.

## Локализация
- `Localizable.xcstrings`, языки `ru` (базовый) и `en`.
- Переключатель в игре: `LanguageManager` хранит выбор, прокидывает `\.locale` в окружение корневого вью; строки через `String(localized:locale:)` / `Text(LocalizedStringKey)`.
- Числовой формат зависит от выбранного языка.

## Ошибки
Ошибки облака не блокируют игру: статус в Настройках + повтор при следующем сохранении. Повреждённый локальный сейв → бэкап-копия `save.prev.json`.

## Веб / Telegram Mini App (`web/`)
```
web/src/core/       порт HelpDeskCore на TS без зависимостей (тесты: node --test)
web/src/app/        store (signals), планировщик сохранений, i18n из .xcstrings, иконки
web/src/platform/   telegram.ts (SDK), storage.ts (localStorage + prev), cloud.ts (supabase-js)
web/src/ui/         экраны Preact по iOS-версии; цвета — web/src/theme/tokens.css
supabase/functions/telegram-auth/   initData → сессия Supabase по Telegram ID
.github/workflows/pages.yml         тесты + сборка + GitHub Pages
```
- Баланс, строки, иконки и шрифты веб берёт из iOS-папок этого репо (импорт, не копия).
- Сейв: localStorage `hdi.save` (+ `hdi.save.prev`), облако — отдельный проект Supabase, таблица `game_saves`; формат `payload` — веб-`GameState` (время в мс).
- Вход только в Telegram; вне Telegram — локальная игра (для разработки).
