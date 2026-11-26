create schema if not exists nova_private;

create table if not exists public.nova_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  provider text not null default 'openai-compatible' check (char_length(provider) between 1 and 50),
  base_url text not null check (base_url like 'https://%'),
  secret_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.nova_api_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid not null references public.nova_api_keys(id) on delete cascade,
  model_id text not null check (char_length(btrim(model_id)) between 1 and 200),
  display_name text not null default '',
  enabled boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (api_key_id, model_id),
  foreign key (user_id, api_key_id) references public.nova_api_keys(user_id, id) on delete cascade
);

create table if not exists public.nova_ai_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  routing_mode text not null default 'auto' check (routing_mode in ('auto','manual')),
  selected_model_id uuid references public.nova_api_models(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.nova_api_keys enable row level security;
alter table public.nova_api_models enable row level security;
alter table public.nova_ai_preferences enable row level security;

drop policy if exists nova_api_keys_select_own on public.nova_api_keys;
create policy nova_api_keys_select_own on public.nova_api_keys
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists nova_api_models_select_own on public.nova_api_models;
create policy nova_api_models_select_own on public.nova_api_models
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists nova_ai_preferences_manage_own on public.nova_ai_preferences;
create policy nova_ai_preferences_manage_own on public.nova_ai_preferences
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function nova_private.nova_store_api_secret(p_name text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret_id uuid;
begin
  if p_secret is null or length(p_secret) < 8 or length(p_secret) > 4096 then
    raise exception 'Invalid API key';
  end if;
  select (vault.create_secret(p_secret, left(coalesce(p_name, 'NOVA provider key'), 100), 'NOVA provider API credential')).id
    into v_secret_id;
  return v_secret_id;
end;
$$;

create or replace function nova_private.nova_read_api_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id limit 1;
$$;

revoke all on function nova_private.nova_store_api_secret(text,text) from public, anon, authenticated;
revoke all on function nova_private.nova_read_api_secret(uuid) from public, anon, authenticated;
grant usage on schema nova_private to service_role;
grant execute on function nova_private.nova_store_api_secret(text,text) to service_role;
grant execute on function nova_private.nova_read_api_secret(uuid) to service_role;

grant select on public.nova_api_keys, public.nova_api_models, public.nova_ai_preferences to authenticated;
grant select, insert, update, delete on public.nova_ai_preferences to authenticated;
