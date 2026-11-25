-- Correção (25/11): o SQL da Fase 1 (objetivo e celular) não tinha sido aplicado no banco real, e a exclusão de contas
-- dependia da tabela account_goals. Este arquivo:
-- 1) aplica a Fase 1 de forma segura (só cria o que falta);
-- 2) refaz admin_delete_account para apagar dados pessoais só das tabelas que existem.

-- Fase 1 do focus group (primeiro acesso):
-- 1) Objetivo principal da pessoa ("Defina seu objetivo" no caminho inicial). Visível só ao titular.
-- 2) Celular editável pela própria pessoa, inclusive quem entrou com Google (que não informa telefone).

create table if not exists public.account_goals (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 goal text not null check (goal in ('emagrecer','ganhar_massa','condicionamento','saude_bem_estar','dor_reabilitacao','performance','mente_estresse','alimentacao')),
 updated_at timestamptz not null default now()
);
alter table public.account_goals enable row level security;
revoke all on public.account_goals from public, anon, authenticated;
grant select on public.account_goals to authenticated;
grant select, insert, update, delete on public.account_goals to service_role;
drop policy if exists account_goals_read_self on public.account_goals;
create policy account_goals_read_self on public.account_goals for select to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.account_goals is 'Objetivo principal escolhido pela própria pessoa no caminho inicial. Lido só pelo titular.';

create or replace function wellness_private.set_my_goal(p_goal text)
 returns public.account_goals language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.account_goals;
begin
 if p_goal is null or p_goal not in ('emagrecer','ganhar_massa','condicionamento','saude_bem_estar','dor_reabilitacao','performance','mente_estresse','alimentacao') then
  raise exception using errcode = '22023', message = 'Objetivo inválido.';
 end if;
 insert into public.account_goals (user_id, goal) values (actor, p_goal)
 on conflict (user_id) do update set goal = excluded.goal, updated_at = now()
 returning * into result;
 return result;
end $fn$;

-- Grava ou corrige o celular da própria conta (mesma validação do cadastro). Trocar o número zera a verificação.
create or replace function wellness_private.set_my_phone(p_phone text)
 returns table (phone text, phone_verified_at timestamptz) language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_phone text := wellness_private.normalize_signup_phone(p_phone);
begin
 if v_phone is null then raise exception using errcode = '22023', message = 'Celular inválido.'; end if;
 insert into public.account_contacts (user_id, phone) values (actor, v_phone)
 on conflict (user_id) do update set phone = excluded.phone;
 return query select c.phone, c.phone_verified_at from public.account_contacts c where c.user_id = actor;
end $fn$;

create or replace function public.set_my_goal(p_goal text) returns setof public.account_goals
 language sql security invoker set search_path = '' as $$select * from wellness_private.set_my_goal(p_goal)$$;
create or replace function public.set_my_phone(p_phone text) returns table (phone text, phone_verified_at timestamptz)
 language sql security invoker set search_path = '' as $$select * from wellness_private.set_my_phone(p_phone)$$;

revoke all on function wellness_private.set_my_goal(text), public.set_my_goal(text),
 wellness_private.set_my_phone(text), public.set_my_phone(text) from public, anon, authenticated;
grant execute on function wellness_private.set_my_goal(text), public.set_my_goal(text),
 wellness_private.set_my_phone(text), public.set_my_phone(text) to authenticated;

create or replace function wellness_private.admin_delete_account(p_user uuid, p_confirm text, p_reason text) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,'')); target public.profiles; v_email text; outcome text; t text; col text;
begin
 if char_length(v_reason) not between 3 and 500 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 500 caracteres).'; end if;
 select * into target from public.profiles p where p.id = p_user for update;
 if not found or p_user = actor or target.role = 'admin' then raise exception using errcode = '42501', message = 'Esta conta não pode ser excluída por aqui.'; end if;
 select to_jsonb(u)->>'email' into v_email from auth.users u where u.id = p_user;
 if lower(btrim(coalesce(p_confirm,''))) not in (lower(coalesce(v_email,'')), lower(btrim(target.display_name))) or btrim(coalesce(p_confirm,'')) = '' then
  raise exception using errcode = '22023', message = 'Para confirmar, digite exatamente o e-mail ou o nome da conta.'; end if;
 -- Configurações do parceiro (sem valor de histórico).
 if to_regclass('public.professional_availability_days') is not null then delete from public.professional_availability_days where professional_id = p_user; end if;
 if to_regclass('public.professional_booking_terms') is not null then delete from public.professional_booking_terms where professional_id = p_user; end if;
 begin
  delete from auth.users where id = p_user;
  outcome := 'excluida';
 exception when foreign_key_violation then
  outcome := 'anonimizada';
 end;
 if outcome = 'anonimizada' then
  -- Mantém só o que precisa ficar (financeiro/histórico), sem dados pessoais.
  update public.profiles set display_name = 'Conta excluída', approved = false, role = case when role = 'profissional' then 'profissional' else 'aluno' end where id = p_user;
  -- Dados pessoais (cada tabela só se existir no banco).
  for t, col in select * from (values ('account_contacts','user_id'),('account_locations','user_id'),('account_goals','user_id'),('professional_profiles','user_id'),
    ('hydration_days','user_id'),('hydration_settings','user_id'),('challenge_participants','user_id')) v(t, col) loop
   if to_regclass('public.' || t) is not null then execute format('delete from public.%I where %I = $1', t, col) using p_user; end if;
  end loop;
  if to_regclass('public.reviews') is not null then delete from public.reviews where reviewer_id = p_user or reviewee_id = p_user; end if;
  update public.student_professional_links set state = 'revoked', revoked_at = coalesce(revoked_at, now())
   where (student_id = p_user or professional_id = p_user) and state <> 'revoked';
  if to_regclass('public.professional_contents') is not null then update public.professional_contents set status = 'arquivado', updated_at = now() where owner_id = p_user and status <> 'arquivado'; end if;
  if to_regclass('public.challenges') is not null then update public.challenges set status = 'arquivado' where owner_id = p_user and status <> 'arquivado'; end if;
  if to_regclass('public.feed_videos') is not null then update public.feed_videos set status = 'removed' where professional_id = p_user and status in ('pending','approved'); end if;
  -- Bloqueia o login e libera o e-mail (só existe no Supabase; ignorado onde as colunas não existirem).
  begin
   if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    execute 'update auth.users set banned_until = ''infinity'' where id = $1' using p_user;
   end if;
   execute 'update auth.users set email = $2 where id = $1' using p_user, 'excluida-' || p_user::text || '@conta-excluida.invalid';
   if to_regclass('auth.identities') is not null then execute 'delete from auth.identities where user_id = $1' using p_user; end if;
   if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using p_user; end if;
  exception when others then
   outcome := 'anonimizada_sem_bloqueio';
  end;
 end if;
 insert into public.admin_actions (actor_id, action, target_id, target_name, reason)
  values (actor, case when outcome = 'excluida' then 'excluir_conta' else 'anonimizar_conta' end, p_user, target.display_name, v_reason);
 return outcome;
end $fn$;

notify pgrst, 'reload schema';
