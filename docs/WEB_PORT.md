# Web / Telegram Mini App — порт игры (план-набросок)

Статус: **дизайн этапа 1 — `docs/superpowers/specs/2026-10-15-web-telegram-stage1-design.md`.** Этот репозиторий (`help-desk-idle-web`) — копия iOS-репо `apelsinchikov/help-desk-idle` на момент закрытия этапа 1 (2026-10-15); здесь делается веб / Telegram Mini App версия в папке `web/`.
Механика, баланс и тексты должны совпадать с iOS-репо: меняешь баланс там — повтори здесь (и наоборот). iOS-код (`HelpDeskIdle/`, `Packages/`) здесь — справочник для порта, не трогать.

## Цель
Та же игра (этап 1 «Ядро»), запускаемая как Telegram Mini App (WebView) и в обычном браузере. Сохранение — **отдельный** проект Supabase с той же схемой `game_saves`.

## Что общее с iOS (не дублировать, а переиспользовать)
- Баланс: `Packages/HelpDeskCore/Sources/HelpDeskCore/Resources/{jobs,milestones,config}.json` — веб читает ЭТИ ЖЕ файлы (копирование на сборке или прямой импорт), не свою копию.
- Правила и формулы: `docs/GAME_DESIGN.md`, `docs/ECONOMY.md`, `docs/PROGRESSION.md`.
- Тексты RU/EN: `HelpDeskIdle/HelpDeskIdle/Localization/Localizable.xcstrings` (JSON) — веб берёт строки оттуда же.
- Макеты (HTML) — артефакт «Help Desk Idle — главный экран».
- Схема `public.game_saves` (`supabase/migrations/`) — применена в отдельном проекте Supabase веб-версии; формат `payload` — веб-`GameState` (свой, не iOS).

## Что пишется заново
- `web/` — Vite + TypeScript + Preact + `@preact/signals`.
- `web/src/core/` — порт `HelpDeskCore` на TS 1:1 (Economy, MilestoneMath, форматтеры, GameState, GameEngine, оффлайн, SavePicker) + тесты (Vitest) **с теми же числами**, что в Swift-тестах.
- UI по макетам темы A; токены цветов — те же значения, что в `Theme.swift`.

## Решения, которые нужно принять в начале
1. **Хостинг.** ✅ GitHub Pages (репо `help-desk-idle-web` публичный), деплой через GitHub Actions из `main`.
2. **Вход.** ✅ В Telegram — по `initData`: Supabase Edge Function проверяет подпись токеном бота и выдаёт сессию по Telegram ID (прогресс общий на всех устройствах). Вне Telegram — только локальный сейв для разработки, без анонимного входа. Сейвы с iOS не совместимы (и не нужны).
3. **Платежи (этап 4).** В Telegram цифровые товары — только за Telegram Stars.
4. **Паритет.** Каждая механика делается на обеих платформах; общий баланс в JSON и одинаковые тесты — гарантия одинаковой математики.

## Механика (кратко, детали — GAME_DESIGN)
Без менеджера работа стартует только тапом → цикл → «Готово — собрать» → тап собирает и работа встаёт (idle). Менеджер сам стартует и собирает. Открытие работы: уровень 25 предыдущей + оплата baseCost. Оффлайн-доход только от работ с менеджером, лимит 24 ч.
