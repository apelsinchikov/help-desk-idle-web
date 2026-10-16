# Веб — рейтинг: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** пункт меню «Рейтинг» — топ-50 по заработанному за всё время, своя строка, пересчёт базой раз в 5 мин.
**Spec:** `docs/superpowers/specs/2026-10-16-web-leaderboard-design.md`

## Global Constraints
- Клиент читает рейтинг не чаще раза в 5 мин (300 000 мс); без облака рейтинга нет.
- Имя: `first_name` + « X.» из `last_name`, ≤ 32 символов; пусто → «Игрок» (на стороне SQL).
- Коммиты от автора, без трейлеров. Тесты `node --test "src/**/*.test.ts"`, типы `tsc --noEmit`.

## Review Focus
1. Повторное открытие рейтинга раньше 5 мин не делает запросов — тест Task 2.
2. Ошибка сети не ломает экран и не кэшируется как успех — тест Task 2.
3. Игрок без строки в рейтинге (ещё не выгрузился / пересчёт не прошёл) — экран показывает топ без своей строки — Task 4.

### Task 1: Миграция
**Files:** Create `supabase/migrations/20261016130000_leaderboard.sql`
- [ ] `display_name` в `game_saves`; таблица `leaderboard` + RLS (select to authenticated using true, grant select);
  `refresh_leaderboard()` (security invoker, `set search_path = ''`, revoke execute от public/anon/authenticated);
  `create extension if not exists pg_cron with schema pg_catalog`; `cron.schedule('refresh-leaderboard', '*/5 * * * *', …)`,
  `cron.schedule('cleanup-cron-history', '0 3 * * *', …)`; первый пересчёт `select public.refresh_leaderboard()`. Commit.

### Task 2: Кэш и имя
**Files:** Create `web/src/app/leaderboard.ts`, `web/src/app/leaderboard.test.ts`
**Produces:** `type LeaderRow = { place: number; name: string; earned: number; me: boolean }`;
`type Leaderboard = { top: LeaderRow[]; me: LeaderRow | null; refreshedAt: number }`;
`createLeaderboardCache(fetch: () => Promise<Leaderboard>, now: () => number, ttlMs = 300_000)` → `{ get(): Promise<Leaderboard> }`;
`displayName(user?: { first_name?: string; last_name?: string }): string`.
- [ ] Тесты: второй `get` в пределах 5 мин — без нового `fetch`; через 5 мин — новый; ошибка не кэшируется;
  параллельные `get` — один `fetch`; `displayName({first_name:'Евгений', last_name:'Ассылов'}) === 'Евгений А.'`, обрезка 32, пусто → ''.
- [ ] Реализация, PASS, commit.

### Task 3: Облако
**Files:** Modify `web/src/platform/cloud.ts`, `web/src/platform/telegram.ts`
- [ ] `upload` пишет `display_name`; `leaderboard()` — `from('leaderboard').select(...).order('place').limit(50)` и своя строка
  `.eq('user_id', id).maybeSingle()`; `telegram.displayName`. `tsc` зелёный, commit.

### Task 4: Экран и меню
**Files:** Create `web/src/ui/Leaderboard.tsx`; Modify `store.ts` (опция `leaderboard`, `Route` + `'leaderboard'`), `main.tsx`, `Menu.tsx`, `App.tsx`, `styles.css`, `.xcstrings`
- [ ] Экран: топ-50 (место, имя, `money(earned)`), своя строка подсвечена, если не в топе — отдельно внизу; «обновлено N мин назад»;
  загрузка / ошибка «Не удалось загрузить рейтинг». Меню: «Рейтинг», без облака — закрыт «Рейтинг — в Telegram».
- [ ] Тесты и `tsc` зелёные, commit. Автор: `git push`, `npx supabase db push`, PR в `main`.
