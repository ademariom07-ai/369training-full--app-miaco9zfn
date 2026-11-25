-- O próprio usuário (aluno ou parceiro) exclui a conta e os dados (LGPD, art. 18). Admins não se autoexcluem.
-- A lógica de exclusão/anonimização é a mesma do admin, agora numa função interna única (erase_account).
-- Confirmação: digitar o próprio e-mail. Fica no registro de ações como "autoexclusão".

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
 check (action in ('excluir_conta','anonimizar_conta','suspender_parceiro','reativar_parceiro','autoexclusao','autoexclusao_anonimizada'));

-- Apaga (ou anonimiza, se houver registros que precisam ficar) a conta p_user. Retorna 'excluida', 'anonimizada' ou 'anonimizada_sem_bloqueio'.
create or replace function wellness_private.erase_account(p_user uuid) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare outcome text; t text; col text;
begin
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
 return outcome;
end $fn$;
revoke all on function wellness_private.erase_account(uuid) from public, anon, authenticated;

create or replace function wellness_private.admin_delete_account(p_user uuid, p_confirm text, p_reason text) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,'')); target public.profiles; v_email text; outcome text;
begin
 if char_length(v_reason) not between 3 and 500 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 500 caracteres).'; end if;
 select * into target from public.profiles p where p.id = p_user for update;
 if not found or p_user = actor or target.role = 'admin' then raise exception using errcode = '42501', message = 'Esta conta não pode ser excluída por aqui.'; end if;
 select to_jsonb(u)->>'email' into v_email from auth.users u where u.id = p_user;
 if lower(btrim(coalesce(p_confirm,''))) not in (lower(coalesce(v_email,'')), lower(btrim(target.display_name))) or btrim(coalesce(p_confirm,'')) = '' then
  raise exception using errcode = '22023', message = 'Para confirmar, digite exatamente o e-mail ou o nome da conta.'; end if;
 outcome := wellness_private.erase_account(p_user);
 insert into public.admin_actions (actor_id, action, target_id, target_name, reason)
  values (actor, case when outcome = 'excluida' then 'excluir_conta' else 'anonimizar_conta' end, p_user, target.display_name, v_reason);
 return outcome;
end $fn$;

-- Autoexclusão. p_confirm: o próprio e-mail. p_reason: opcional (ajuda a melhorar o app).
create or replace function wellness_private.delete_my_account(p_confirm text, p_reason text) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); target public.profiles; v_email text; outcome text;
 v_reason text := coalesce(nullif(btrim(coalesce(p_reason,'')), ''), 'Pedido do próprio usuário');
begin
 select * into target from public.profiles p where p.id = actor for update;
 if target.role = 'admin' then raise exception using errcode = '42501', message = 'Contas de administrador não podem ser excluídas por aqui.'; end if;
 select to_jsonb(u)->>'email' into v_email from auth.users u where u.id = actor;
 if btrim(coalesce(p_confirm,'')) = '' or lower(btrim(p_confirm)) <> lower(coalesce(v_email,'')) then
  raise exception using errcode = '22023', message = 'Para confirmar, digite exatamente o e-mail da sua conta.'; end if;
 outcome := wellness_private.erase_account(actor);
 insert into public.admin_actions (actor_id, action, target_id, target_name, reason)
  values (case when outcome = 'excluida' then null else actor end, case when outcome = 'excluida' then 'autoexclusao' else 'autoexclusao_anonimizada' end,
   actor, target.display_name, left(v_reason, 500));
 return outcome;
end $fn$;
create or replace function public.delete_my_account(p_confirm text, p_reason text) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.delete_my_account(p_confirm, p_reason)$$;
revoke all on function wellness_private.delete_my_account(text,text), public.delete_my_account(text,text) from public, anon, authenticated;
grant execute on function wellness_private.delete_my_account(text,text), public.delete_my_account(text,text) to authenticated;

notify pgrst, 'reload schema';
