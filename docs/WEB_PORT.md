# Web / Telegram Mini App — порт игры (план-набросок)

Статус: **этап 1 в `main` (бот); этап 2a (повышения, улучшения, достижения, обучение) — в `dev`.** Дизайн — `docs/superpowers/specs/2026-10-15-web-telegram-stage1-design.md`, план — `docs/superpowers/plans/2026-10-15-web-telegram-stage1.md`. Этот репозиторий (`help-desk-idle-web`) — копия iOS-репо `apelsinchikov/help-desk-idle` на момент закрытия этапа 1 (2026-10-15); здесь делается веб / Telegram Mini App версия в папке `web/`.
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
- `web/src/core/` — порт `HelpDeskCore` на TS 1:1 (Economy, MilestoneMath, форматтеры, GameState, GameEngine, оффлайн, SavePicker) + тесты (`node --test`) **с теми же числами**, что в Swift-тестах.
- UI по макетам темы A; токены цветов — те же значения, что в `Theme.swift`.

## Решения, которые нужно принять в начале
1. **Хостинг.** ✅ GitHub Pages (репо публичный), одна выкладка с двумя сборками (`.github/workflows/pages.yml`, пуш в `dev` или `main` пересобирает обе):
   - `main` → https://apelsinchikov.github.io/help-desk-idle-web/ — рабочая, к ней подключён @helpdeskidle_bot, облако Supabase;
   - `dev` → https://apelsinchikov.github.io/help-desk-idle-web/dev/ — тестовая, только браузер, без облака, сейвы `hdi.dev.*`, метка DEV.
   В бота попадает только то, что прошло PR `dev` → `main`.
2. **Вход.** ✅ В Telegram — по `initData`: Supabase Edge Function проверяет подпись токеном бота и выдаёт сессию по Telegram ID (прогресс общий на всех устройствах). Вне Telegram — только локальный сейв для разработки, без анонимного входа. Сейвы с iOS не совместимы (и не нужны).
3. **Платежи (этап 4).** В Telegram цифровые товары — только за Telegram Stars.
4. **Паритет.** Каждая механика делается на обеих платформах; общий баланс в JSON и одинаковые тесты — гарантия одинаковой математики.

## Механика (кратко, детали — GAME_DESIGN)
Без менеджера работа идёт сама → «Готово. Заберите оплату» → тап по иконке собирает и сразу запускает новый цикл. Менеджер сам стартует и собирает. Открытие работы: уровень 25 предыдущей + оплата baseCost. Оффлайн-доход только от работ с менеджером, лимит 2 ч.

## Как работать с веб-версией
- Команды (Терминал, папка `web/`): `npm install`, `npm test`, `npm run dev` (→ http://localhost:5173/help-desk-idle-web/), `npm run build`.
- Ключи для локального запуска: `web/.env.local` по образцу `web/.env.example`. Вне Telegram облако выключено — это нормально.
- Edge Function: `npx supabase login`, затем из корня репо `npx supabase functions deploy telegram-auth --project-ref <ref> --no-verify-jwt`. Секрет `TELEGRAM_BOT_TOKEN` — в Dashboard → Edge Functions → Secrets.
- Supabase → Authentication → Sign In / Providers: **выключить** «Allow new users to sign up» и Anonymous sign-ins — игроки создаются только функцией `telegram-auth` (Admin API работает и при выключенной регистрации).
- Бот: BotFather → `/mybots` → бот → Bot Settings → Configure Mini App → URL `https://apelsinchikov.github.io/help-desk-idle-web/`; `/setmenubutton` — тот же URL.
