-- Admin: gestão de usuários (busca, aprovação/suspensão de parceiros, exclusão de contas) com registro de auditoria.
-- Excluir conta:
--  * nunca o próprio admin nem outro admin; exige o motivo e a confirmação com o e-mail (ou o nome) da conta;
--  * remove os dados de configuração do parceiro (disponibilidade e regras de agendamento) e apaga o usuário do Auth
--    (o perfil e quase todos os dados saem em cascata);
--  * se houver registros que precisam ser guardados (reservas, carteira, serviços, planos antigos), a conta é
--    ANONIMIZADA: nome "Conta excluída", dados pessoais apagados, vínculos encerrados, conteúdos e desafios arquivados,
--    login bloqueado e e-mail liberado. O resultado diz qual dos dois aconteceu.
-- Parceiros: aprovar/recusar continua pelo fluxo de "Aprovações"; aqui o admin também suspende e reativa um parceiro.

create table public.admin_actions (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check (action in ('excluir_conta','anonimizar_conta','suspender_parceiro','reativar_parceiro')),
 target_id uuid not null,
 target_name text,
 reason text not null check (char_length(reason) between 3 and 500),
 created_at timestamptz not null default now()
);
create index admin_actions_created on public.admin_actions(created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from public, anon, authenticated;
grant select, insert on public.admin_actions to service_role;
comment on table public.admin_actions is 'Auditoria das ações do admin sobre contas. Só leitura pelas funções.';

create function wellness_private.require_admin() returns uuid
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then raise exception using errcode = '42501', message = 'Acesso indisponível.'; end if;
 return actor;
end $fn$;
revoke all on function wellness_private.require_admin() from public, anon, authenticated;

-- Lista/busca de usuários (nome ou e-mail), com papel, aprovação, pedido de parceiro e último acesso.
create function wellness_private.admin_list_users(p_query text, p_role text, p_page integer)
 returns table (user_id uuid, display_name text, email text, role text, approved boolean, created_at timestamptz, last_sign_in_at timestamptz,
  application_status text, application_version bigint, specialty text, credential text, active_links integer, deleted boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); q text := nullif(lower(btrim(coalesce(p_query,''))), '');
begin
 if coalesce(p_page, 0) not between 1 and 200 or (p_role is not null and p_role not in ('aluno','profissional','parceiro_pendente','admin','pedido_pendente')) then
  raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 return query
 select p.id, p.display_name, (to_jsonb(u)->>'email'), p.role, p.approved, p.created_at, (to_jsonb(u)->>'last_sign_in_at')::timestamptz,
  a.status, a.version, a.specialty, a.credential,
  (select count(*)::int from public.student_professional_links k where k.state = 'active' and (k.student_id = p.id or k.professional_id = p.id)),
  p.display_name = 'Conta excluída'
 from public.profiles p left join auth.users u on u.id = p.id left join public.professional_applications a on a.applicant_id = p.id
 where (q is null or lower(p.display_name) like '%' || q || '%' or lower(coalesce(to_jsonb(u)->>'email','')) like '%' || q || '%')
  and (p_role is null
   or (p_role = 'aluno' and p.role = 'aluno')
   or (p_role = 'profissional' and p.role = 'profissional' and p.approved)
   or (p_role = 'parceiro_pendente' and p.role = 'profissional' and not p.approved)
   or (p_role = 'admin' and p.role = 'admin')
   or (p_role = 'pedido_pendente' and a.status = 'pending'))
 order by (a.status = 'pending') desc nulls last, p.created_at desc
 limit 30 offset (p_page - 1) * 30;
end $fn$;

-- Suspende (approved = false) ou reativa um parceiro que já foi aprovado.
create function wellness_private.admin_set_partner(p_user uuid, p_active boolean, p_reason text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,'')); target public.profiles;
begin
 if char_length(v_reason) not between 3 and 500 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 500 caracteres).'; end if;
 select * into target from public.profiles p where p.id = p_user for update;
 if not found or target.role <> 'profissional'
  or not exists (select 1 from public.professional_applications a where a.applicant_id = p_user and a.status = 'approved') then
  raise exception using errcode = '42501', message = 'Só parceiros já aprovados podem ser suspensos ou reativados.'; end if;
 update public.profiles set approved = p_active where id = p_user;
 insert into public.admin_actions (actor_id, action, target_id, target_name, reason)
  values (actor, case when p_active then 'reativar_parceiro' else 'suspender_parceiro' end, p_user, target.display_name, v_reason);
end $fn$;

-- Exclui (ou anonimiza) uma conta. p_confirm precisa ser o e-mail ou o nome exato da conta.
create function wellness_private.admin_delete_account(p_user uuid, p_confirm text, p_reason text) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,'')); target public.profiles; v_email text; outcome text;
begin
 if char_length(v_reason) not between 3 and 500 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 500 caracteres).'; end if;
 select * into target from public.profiles p where p.id = p_user for update;
 if not found or p_user = actor or target.role = 'admin' then raise exception using errcode = '42501', message = 'Esta conta não pode ser excluída por aqui.'; end if;
 select to_jsonb(u)->>'email' into v_email from auth.users u where u.id = p_user;
 if lower(btrim(coalesce(p_confirm,''))) not in (lower(coalesce(v_email,'')), lower(btrim(target.display_name))) or btrim(coalesce(p_confirm,'')) = '' then
  raise exception using errcode = '22023', message = 'Para confirmar, digite exatamente o e-mail ou o nome da conta.'; end if;
 -- Configurações do parceiro (sem valor de histórico).
 delete from public.professional_availability_days where professional_id = p_user;
 delete from public.professional_booking_terms where professional_id = p_user;
 begin
  delete from auth.users where id = p_user;
  outcome := 'excluida';
 exception when foreign_key_violation then
  outcome := 'anonimizada';
 end;
 if outcome = 'anonimizada' then
  -- Mantém só o que precisa ficar (financeiro/histórico), sem dados pessoais.
  update public.profiles set display_name = 'Conta excluída', approved = false, role = case when role = 'profissional' then 'profissional' else 'aluno' end where id = p_user;
  delete from public.account_contacts where user_id = p_user;
  delete from public.account_locations where user_id = p_user;
  delete from public.account_goals where user_id = p_user;
  delete from public.professional_profiles where user_id = p_user;
  delete from public.hydration_days where user_id = p_user;
  delete from public.hydration_settings where user_id = p_user;
  delete from public.challenge_participants where user_id = p_user;
  delete from public.reviews where reviewer_id = p_user or reviewee_id = p_user;
  update public.student_professional_links set state = 'revoked', revoked_at = coalesce(revoked_at, now())
   where (student_id = p_user or professional_id = p_user) and state <> 'revoked';
  update public.professional_contents set status = 'arquivado', updated_at = now() where owner_id = p_user and status <> 'arquivado';
  update public.challenges set status = 'arquivado' where owner_id = p_user and status <> 'arquivado';
  update public.feed_videos set status = 'removed' where professional_id = p_user and status in ('pending','approved');
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

-- Últimas ações do admin (auditoria).
create function wellness_private.admin_list_actions()
 returns table (created_at timestamptz, actor_name text, action text, target_name text, reason text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin();
begin
 return query select a.created_at, coalesce(p.display_name, 'Admin removido'), a.action, a.target_name, a.reason
  from public.admin_actions a left join public.profiles p on p.id = a.actor_id order by a.created_at desc limit 100;
end $fn$;

create function public.admin_list_users(p_query text, p_role text, p_page integer)
 returns table (user_id uuid, display_name text, email text, role text, approved boolean, created_at timestamptz, last_sign_in_at timestamptz,
  application_status text, application_version bigint, specialty text, credential text, active_links integer, deleted boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.admin_list_users(p_query, p_role, p_page)$$;
create function public.admin_set_partner(p_user uuid, p_active boolean, p_reason text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.admin_set_partner(p_user, p_active, p_reason)$$;
create function public.admin_delete_account(p_user uuid, p_confirm text, p_reason text) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.admin_delete_account(p_user, p_confirm, p_reason)$$;
create function public.admin_list_actions() returns table (created_at timestamptz, actor_name text, action text, target_name text, reason text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.admin_list_actions()$$;

revoke all on function
 wellness_private.admin_list_users(text,text,integer), public.admin_list_users(text,text,integer),
 wellness_private.admin_set_partner(uuid,boolean,text), public.admin_set_partner(uuid,boolean,text),
 wellness_private.admin_delete_account(uuid,text,text), public.admin_delete_account(uuid,text,text),
 wellness_private.admin_list_actions(), public.admin_list_actions()
 from public, anon, authenticated;
grant execute on function
 wellness_private.admin_list_users(text,text,integer), public.admin_list_users(text,text,integer),
 wellness_private.admin_set_partner(uuid,boolean,text), public.admin_set_partner(uuid,boolean,text),
 wellness_private.admin_delete_account(uuid,text,text), public.admin_delete_account(uuid,text,text),
 wellness_private.admin_list_actions(), public.admin_list_actions()
 to authenticated;

notify pgrst, 'reload schema';
