create table if not exists public.nova_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(btrim(action)) between 1 and 40),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);
alter table public.nova_rate_limit_buckets enable row level security;
revoke all on public.nova_rate_limit_buckets from anon, authenticated;

create or replace function public.nova_consume_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_window_started_at timestamptz;
begin
  if p_user_id is null
     or p_action is null
     or char_length(btrim(p_action)) not between 1 and 40
     or p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'Invalid rate limit arguments';
  end if;

  insert into public.nova_rate_limit_buckets (user_id, action, window_started_at, request_count)
  values (p_user_id, p_action, now(), 0)
  on conflict (user_id, action) do nothing;

  select request_count, window_started_at
    into v_count, v_window_started_at
    from public.nova_rate_limit_buckets
    where user_id = p_user_id and action = p_action
    for update;

  if v_window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.nova_rate_limit_buckets
      set window_started_at = now(), request_count = 1, updated_at = now()
      where user_id = p_user_id and action = p_action;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update public.nova_rate_limit_buckets
    set request_count = v_count + 1, updated_at = now()
    where user_id = p_user_id and action = p_action;
  return true;
end;
$$;

revoke all on function public.nova_consume_rate_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.nova_consume_rate_limit(uuid,text,integer,integer) to service_role;
