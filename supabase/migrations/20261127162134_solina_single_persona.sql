-- Solina is the only supported persona. Remove legacy persona conversations;
-- nova_messages rows are removed by the conversation FK ON DELETE CASCADE.
delete from public.nova_conversations where persona <> 'soleen';

alter table public.nova_conversations
  drop constraint if exists nova_conversations_persona_check;

alter table public.nova_conversations
  add constraint nova_conversations_persona_check check (persona = 'soleen');
