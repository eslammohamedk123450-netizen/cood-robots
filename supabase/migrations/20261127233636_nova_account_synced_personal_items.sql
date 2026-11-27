-- SOLINA account-synced personal items: reminders, alarms, tasks and notes.
create table if not exists public.nova_personal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('note','task','reminder','alarm')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  content text not null default '' check (char_length(content) <= 12000),
  scheduled_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nova_personal_items_schedule_type_check
    check ((item_type in ('reminder','alarm') and scheduled_at is not null) or (item_type in ('note','task')))
);
create index if not exists nova_personal_items_owner_type_status_idx
  on public.nova_personal_items(user_id, item_type, status, updated_at desc);
create index if not exists nova_personal_items_owner_schedule_idx
  on public.nova_personal_items(user_id, scheduled_at asc)
  where status = 'active' and scheduled_at is not null;
alter table public.nova_personal_items enable row level security;
drop policy if exists nova_personal_items_no_direct_access on public.nova_personal_items;
create policy nova_personal_items_no_direct_access on public.nova_personal_items
  for all to anon, authenticated using (false) with check (false);
revoke all on public.nova_personal_items from anon, authenticated;
grant all on public.nova_personal_items to service_role;
