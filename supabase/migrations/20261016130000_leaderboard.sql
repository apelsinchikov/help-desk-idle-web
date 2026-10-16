-- Рейтинг игроков: имя из Telegram + заработано за всё время. Пересчитывает сама база раз в 5 минут (pg_cron),
-- клиент только читает готовую таблицу.

-- Имя игрока приходит вместе с сейвом.
alter table public.game_saves
  add column if not exists display_name text not null default ''
  check (char_length(display_name) <= 64);

-- Готовый рейтинг: все игроки текущего сезона по месту.
create table if not exists public.leaderboard (
  place             integer          primary key,
  user_id           uuid             not null,
  display_name      text             not null,
  lifetime_earnings double precision not null,
  refreshed_at      timestamptz      not null
);
create index if not exists leaderboard_user_id_idx on public.leaderboard (user_id);

alter table public.leaderboard enable row level security;
grant select on table public.leaderboard to authenticated;

-- Рейтинг публичный для вошедших игроков: в нём только имя и сумма. Писать с клиента нельзя (нет grant и политик).
create policy "leaderboard: read all"
  on public.leaderboard for select
  to authenticated
  using (true);

-- Пересчёт: запускает только pg_cron (от владельца базы), клиентам вызов закрыт.
create or replace function public.refresh_leaderboard()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.leaderboard where true;
  insert into public.leaderboard (place, user_id, display_name, lifetime_earnings, refreshed_at)
  select
    row_number() over (order by s.lifetime_earnings desc, s.updated_at asc),
    s.user_id,
    coalesce(nullif(btrim(s.display_name), ''), 'Игрок'),
    s.lifetime_earnings,
    now()
  from public.game_saves s
  -- только сейвы текущего сезона (после вайпа 2026-10-16)
  where coalesce((s.payload ->> 'season')::integer, 1) >= 2;
end;
$$;

revoke execute on function public.refresh_leaderboard() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Повторный schedule с тем же именем заменяет задачу (upsert).
select cron.schedule('refresh-leaderboard', '*/5 * * * *', 'select public.refresh_leaderboard()');
-- История запусков сама не чистится: раз в сутки удаляем старше суток.
select cron.schedule('cleanup-cron-history', '0 3 * * *', $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$);

select public.refresh_leaderboard();
