-- NOVA single-owner access hardening and memory foundation.
drop policy if exists nova_api_keys_owner_only on public.nova_api_keys;
create policy nova_api_keys_owner_only on public.nova_api_keys
for select to authenticated
using ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()));

drop policy if exists nova_api_models_owner_only on public.nova_api_models;
create policy nova_api_models_owner_only on public.nova_api_models
for select to authenticated
using ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()));

drop policy if exists nova_ai_preferences_owner_only on public.nova_ai_preferences;
create policy nova_ai_preferences_owner_only on public.nova_ai_preferences
for all to authenticated
using ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()))
with check ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()));

create table if not exists public.nova_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general' check (char_length(category) between 1 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists nova_memories_owner_category_idx
  on public.nova_memories(user_id, category, updated_at desc);
alter table public.nova_memories enable row level security;
drop policy if exists nova_memories_owner_only on public.nova_memories;
create policy nova_memories_owner_only on public.nova_memories
for all to authenticated
using ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()))
with check ((select auth.uid()) = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = (select auth.uid()));
revoke all on public.nova_memories from anon, authenticated;

create index if not exists nova_api_keys_user_created_idx on public.nova_api_keys(user_id, created_at desc);
create index if not exists nova_api_models_user_api_key_idx on public.nova_api_models(user_id, api_key_id);
create index if not exists nova_api_models_user_enabled_idx on public.nova_api_models(user_id, enabled);
create index if not exists nova_ai_preferences_selected_model_idx on public.nova_ai_preferences(selected_model_id) where selected_model_id is not null;
