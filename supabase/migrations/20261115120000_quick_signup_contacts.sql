-- Cadastro rápido: nome completo, e-mail, telefone e senha no mesmo formulário.
-- O perfil (sempre aluno, não aprovado) e o telefone são criados no servidor quando a conta
-- de autenticação nasce, a partir do user_metadata enviado no signUp. O metadata é controlado
-- pelo usuário: aqui só se aproveitam nome e telefone, validados; papel e aprovação nunca.

create table public.account_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text not null check (phone ~ '^\+[1-9][0-9]{9,14}$'),
 phone_verified_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.account_contacts enable row level security;
revoke all on public.account_contacts from public, anon, authenticated;
grant select on public.account_contacts to authenticated;
grant update (phone) on public.account_contacts to authenticated;
grant select, insert, update, delete on public.account_contacts to service_role;
create policy account_contacts_read_self on public.account_contacts for select to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy account_contacts_update_self on public.account_contacts for update to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false')
 with check (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.account_contacts is 'Telefone da própria conta. Visível só ao titular. Verificação por SMS/WhatsApp é etapa futura: trocar o número zera phone_verified_at.';

-- Trocar o telefone invalida a verificação anterior.
create function wellness_private.reset_phone_verification() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
begin
 if new.phone is distinct from old.phone then
  new.phone_verified_at := null;
  new.updated_at := now();
 end if;
 return new;
end $fn$;
revoke all on function wellness_private.reset_phone_verification() from public, anon, authenticated;
create trigger account_contacts_reset_verification before update on public.account_contacts
 for each row execute function wellness_private.reset_phone_verification();

-- Converte o telefone digitado no cadastro para o formato internacional (+55DDDNUMERO).
-- Aceita só dígitos depois de remover espaços, parênteses, hífens e o "+". Retorna null se inválido.
create function wellness_private.normalize_signup_phone(p_raw text) returns text
 language plpgsql immutable set search_path = '' as $fn$
declare digits text;
begin
 if p_raw is null or char_length(p_raw) > 40 then return null; end if;
 digits := regexp_replace(p_raw, '[\s()+.-]', '', 'g');
 if digits !~ '^[0-9]+$' then return null; end if;
 if char_length(digits) in (10, 11) then digits := '55' || digits; end if;
 if digits !~ '^55[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$' then return null; end if;
 return '+' || digits;
end $fn$;
revoke all on function wellness_private.normalize_signup_phone(text) from public, anon, authenticated;

create function wellness_private.handle_new_auth_user() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare
 full_name text := btrim(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', ''), '\s+', ' ', 'g'));
 phone text := wellness_private.normalize_signup_phone(new.raw_user_meta_data->>'phone');
begin
 if char_length(full_name) between 1 and 160 then
  insert into public.profiles (id, display_name) values (new.id, full_name) on conflict (id) do nothing;
 end if;
 if phone is not null then
  insert into public.account_contacts (user_id, phone) values (new.id, phone) on conflict (user_id) do nothing;
 end if;
 return new;
end $fn$;
revoke all on function wellness_private.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created_quick_signup after insert on auth.users
 for each row execute function wellness_private.handle_new_auth_user();

-- Contas criadas pelo formulário novo antes desta migração: recupera nome e telefone do metadata.
insert into public.profiles (id, display_name)
 select u.id, btrim(regexp_replace(u.raw_user_meta_data->>'full_name', '\s+', ' ', 'g'))
 from auth.users u
 where char_length(btrim(regexp_replace(coalesce(u.raw_user_meta_data->>'full_name', ''), '\s+', ' ', 'g'))) between 1 and 160
 on conflict (id) do nothing;
insert into public.account_contacts (user_id, phone)
 select u.id, wellness_private.normalize_signup_phone(u.raw_user_meta_data->>'phone')
 from auth.users u
 where wellness_private.normalize_signup_phone(u.raw_user_meta_data->>'phone') is not null
 on conflict (user_id) do nothing;
