create or replace function public.nova_store_api_secret(p_name text, p_secret text)
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

create or replace function public.nova_read_api_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id limit 1;
$$;

revoke all on function public.nova_store_api_secret(text,text) from public, anon, authenticated;
revoke all on function public.nova_read_api_secret(uuid) from public, anon, authenticated;
grant execute on function public.nova_store_api_secret(text,text) to service_role;
grant execute on function public.nova_read_api_secret(uuid) to service_role;
