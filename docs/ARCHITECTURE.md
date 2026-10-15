# Архитектура — Help Desk Idle

## Стек
- Xcode 16+, Swift 6 (strict concurrency где удобно), SwiftUI, iOS 17.0+.
- Состояние: `@Observable` (Observation framework), `@MainActor` для игрового состояния.
- Зависимости (SPM): `supabase-swift` — единственная внешняя.
- Устройства: симулятор Xcode + iPhone 16 Pro Max.

## Структура проекта
```
HelpDeskIdle/
  App/                  HelpDeskIdleApp.swift, RootView (TabView), AppEnvironment
  Core/
    Economy/            Formulas.swift (cost, bulk, max, payout), NumberFormatter+Game
    Model/              JobDefinition, ManagerDefinition, Milestone (из JSON) ; JobState, GameState (сохраняемое)
    Engine/             GameEngine (@Observable: тик, выплаты, покупки, оффлайн)
    Content/            ContentLoader (jobs.json → definitions)
    Persistence/        SaveStore (протокол), LocalSaveStore (JSON в Application Support), CloudSaveStore (Supabase), SaveCoordinator
    Assets/             IconProvider (iconKey → Image)
    Localization/       LanguageManager (переключение RU/EN в игре)
  Features/
    Jobs/               JobsScreen, JobCardView, ProgressBarView, BuyModePicker
    Managers/           ManagersScreen, ManagerRow
    Settings/           SettingsScreen
    Offline/            OfflineEarningsSheet
  Resources/
    Content/jobs.json   баланс + iconKey + id (без текстов)
    Localizable.xcstrings
    Assets.xcassets/Icons/<pack>/<iconKey>.imageset
  Config/
    Secrets.xcconfig    (в .gitignore) SUPABASE_URL, SUPABASE_ANON_KEY
    Secrets.example.xcconfig
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
