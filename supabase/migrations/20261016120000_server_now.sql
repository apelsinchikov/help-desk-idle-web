-- Время сервера для игры: клиент сверяет по нему часы устройства (перки, замена заданий, оффлайн-доход).
-- Только чтение now(), без доступа к данным; вызывать может лишь вошедший игрок.
create or replace function public.server_now()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

revoke execute on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;
