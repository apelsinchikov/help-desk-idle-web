-- Облачный бэкап сейва: одна строка на игрока (анонимный пользователь Supabase Auth).
create table if not exists public.game_saves (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  payload           jsonb            not null,
  schema_version    integer          not null,
  lifetime_earnings double precision not null default 0,
  updated_at        timestamptz      not null default now()
);

alter table public.game_saves enable row level security;

-- С 2026 года новые таблицы не открываются Data API автоматически — выдаём права явно.
-- Анонимные пользователи тоже имеют роль authenticated; доступ к строкам режет RLS ниже.
grant select, insert, update on table public.game_saves to authenticated;

create policy "game_saves: read own"
  on public.game_saves for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "game_saves: insert own"
  on public.game_saves for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "game_saves: update own"
  on public.game_saves for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
