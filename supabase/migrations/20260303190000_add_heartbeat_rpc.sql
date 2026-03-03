-- Safe heartbeat RPC for external schedulers (e.g., GitHub Actions).

begin;

create or replace function public.heartbeat()
returns json
language sql
stable
as $$
  select json_build_object('ok', true, 'ts', now());
$$;

grant execute on function public.heartbeat() to anon;
grant execute on function public.heartbeat() to authenticated;
grant execute on function public.heartbeat() to service_role;

commit;
