-- NOVA single-owner account access and account-scoped memory.
drop policy if exists nova_api_keys_select_own on public.nova_api_keys;
create policy nova_api_keys_owner_only on public.nova_api_keys
for select to authenticated
using (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid());

drop policy if exists nova_api_models_select_own on public.nova_api_models;
create policy nova_api_models_owner_only on public.nova_api_models
for select to authenticated
using (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid());

drop policy if exists nova_ai_preferences_manage_own on public.nova_ai_preferences;
create policy nova_ai_preferences_owner_only on public.nova_ai_preferences
for all to authenticated
using (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid())
with check (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid());

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
using (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid())
with check (auth.uid() = 'f980820b-f59d-453c-9df8-2b9afc695c74'::uuid and user_id = auth.uid());
revoke all on public.nova_memories from anon, authenticated;
