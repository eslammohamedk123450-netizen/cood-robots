create table if not exists public.nova_speech_settings (
  user_id uuid primary key,
  secret_id uuid not null,
  region text not null check (region ~ '^[a-z0-9-]{2,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nova_speech_settings enable row level security;
revoke all on table public.nova_speech_settings from public, anon, authenticated;
grant all on table public.nova_speech_settings to service_role;

create or replace function public.nova_delete_api_secret(p_secret_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_secret_id is null then
    return false;
  end if;
  perform vault.delete_secret(p_secret_id);
  return true;
end;
$function$;

revoke all on function public.nova_delete_api_secret(uuid) from public, anon, authenticated;
grant execute on function public.nova_delete_api_secret(uuid) to service_role;
