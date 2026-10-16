# Веб — рейтинг игроков (дизайн)

Дата: 2026-10-16 · Ветка: `dev` · Статус: на ревью у автора

## Цель
В меню — «Рейтинг»: имя игрока из Telegram и сколько он **заработал за всё время** (`lifetimeEarnings`: траты место не
уменьшают). Обновление не чаще раза в 5 минут; не тратить лишних запросов.

## Готово, когда
1. В Telegram в меню есть «Рейтинг»: топ-50, своя строка подсвечена; если игрок не в топе — его место отдельной строкой внизу;
   подпись «обновлено N мин назад».
2. Рейтинг пересчитывает сама база раз в 5 минут; клиент читает готовую таблицу не чаще раза в 5 минут.
3. Вне Telegram (`/dev/`, браузер) пункт закрыт: «Рейтинг — в Telegram».
4. Тесты: кэш клиента (не чаще 5 мин), имя из Telegram (обрезка, пустое), разбор ответа; SQL проверен на `db push`.

## Данные (Supabase, миграция `…_leaderboard.sql`)
- `game_saves.display_name text not null default ''` (≤ 64 символа) — клиент присылает вместе с сейвом.
- Таблица `public.leaderboard (place int primary key, user_id uuid, display_name text, lifetime_earnings double precision,
  refreshed_at timestamptz)` — **все** игроки текущего сезона по месту; RLS включён, чтение — любому вошедшему игроку
  (`to authenticated using (true)`), записи с клиента нет.
- Функция `public.refresh_leaderboard()` (security invoker): очищает и заново заполняет `leaderboard` из `game_saves`
  с `coalesce((payload->>'season')::int, 1) >= 2`, по убыванию `lifetime_earnings`, пустое имя → «Игрок». Вызов с клиента
  запрещён (`revoke execute … from public, anon, authenticated`).
- `pg_cron` (`create extension if not exists pg_cron with schema pg_catalog`): задача `refresh-leaderboard` каждые 5 минут
  (`*/5 * * * *`) и `cleanup-cron-history` раз в сутки — удаляет историю запусков старше суток.
- Расход: пересчёт — внутри базы, без API. Клиент: при открытии «Рейтинга» — 2 запроса (топ-50 и своя строка), повтор —
  не раньше чем через 5 минут (кэш в памяти). Ответ ~3 КБ. На бесплатном плане число API-запросов не ограничено.

## Имя
`first_name` (+ первая буква `last_name` с точкой, если есть) из Telegram, обрезано до 32 символов; @username не показываем.
Имя берётся из `initDataUnsafe` клиента (как и прогресс — данные игрока, не проверяются сервером).

## Клиент
- `platform/cloud.ts`: `upload` пишет `display_name`; `leaderboard(): Promise<{ top: Row[]; me: Row | null; refreshedAt }>`.
- `app/leaderboard.ts`: кэш на 5 минут (`createLeaderboardCache(fetch, now)`), без облака — `null`.
- `ui/Leaderboard.tsx`: экран, пункт меню «Рейтинг» (открыт всегда в Telegram).

## Вне задачи
Награды за места, сезонные рейтинги, рейтинг друзей.
