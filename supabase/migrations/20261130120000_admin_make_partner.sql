-- Admin aprova parceiro de forma direta, mesmo quando:
--  * a pessoa ainda não preencheu "Seja parceiro" (o admin informa a área e o registro, ex.: CREF/CRN);
--  * o pedido foi recusado antes (vira aprovado com os dados novos);
--  * a pessoa tem vínculo de ALUNO pendente/ativo (bloqueava a aprovação): com p_end_student_link o vínculo é encerrado.
-- Tudo fica no histórico de análises e no registro de ações do admin.

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
 check (action in ('excluir_conta','anonimizar_conta','suspender_parceiro','reativar_parceiro','autoexclusao','autoexclusao_anonimizada','aprovar_parceiro'));

create or replace function wellness_private.admin_make_partner(p_user uuid, p_specialty text, p_credential text, p_reason text, p_end_student_link boolean)
 returns void language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); target public.profiles; app public.professional_applications;
 v_reason text := btrim(coalesce(p_reason,'')); v_cred text := btrim(coalesce(p_credential,'')); v_spec text; v_version bigint;
begin
 if char_length(v_reason) not between 3 and 500 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 500 caracteres).'; end if;
 select * into target from public.profiles p where p.id = p_user for update;
 if not found or p_user = actor or target.role = 'admin' or target.display_name = 'Conta excluída' then
  raise exception using errcode = '42501', message = 'Esta conta não pode virar parceira por aqui.'; end if;
 if target.role = 'profissional' and target.approved then raise exception using errcode = '23505', message = 'Esta conta já é parceira.'; end if;
 select * into app from public.professional_applications a where a.applicant_id = p_user for update;
 v_spec := coalesce(nullif(btrim(coalesce(p_specialty,'')), ''), app.specialty);
 if v_cred = '' then v_cred := coalesce(app.credential, ''); end if;
 if v_spec is null or v_spec not in ('educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais') or char_length(v_cred) not between 1 and 160 then
  raise exception using errcode = '22023', message = 'Informe a área e o registro profissional (ex.: CREF, CRN).'; end if;
 if exists (select 1 from public.student_professional_links l where l.student_id = p_user and l.state in ('pending','active')) then
  if not coalesce(p_end_student_link, false) then
   raise exception using errcode = '23505', message = 'Esta pessoa tem vínculo como aluno. Marque "encerrar o vínculo de aluno" para aprovar.'; end if;
  update public.student_professional_links set state = 'revoked', revoked_at = now(), version = version + 1
   where student_id = p_user and state in ('pending','active');
 end if;
 if app.applicant_id is null then
  insert into public.professional_applications (applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason)
   values (p_user, left(coalesce(nullif(btrim(target.display_name), ''), 'Parceiro'), 160), v_spec, v_cred, 'approved', now(), v_reason) returning version into v_version;
 elsif app.status = 'pending' then
  update public.professional_applications set specialty = v_spec, credential = v_cred, status = 'approved', reviewed_at = now(), review_reason = v_reason
   where applicant_id = p_user returning version into v_version;
 else
  update public.professional_applications set specialty = v_spec, credential = v_cred, status = 'approved', reviewed_at = now(), review_reason = v_reason, version = version + 1
   where applicant_id = p_user returning version into v_version;
 end if;
 insert into public.professional_application_reviews (applicant_id, application_version, reviewer_id, decision, reason, specialty, credential)
  values (p_user, v_version, actor, 'approved', v_reason, v_spec, v_cred) on conflict (applicant_id, application_version) do nothing;
 update public.profiles set role = 'profissional', approved = true where id = p_user;
 insert into public.admin_actions (actor_id, action, target_id, target_name, reason) values (actor, 'aprovar_parceiro', p_user, target.display_name, v_reason);
end $fn$;
create or replace function public.admin_make_partner(p_user uuid, p_specialty text, p_credential text, p_reason text, p_end_student_link boolean) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.admin_make_partner(p_user, p_specialty, p_credential, p_reason, p_end_student_link)$$;
revoke all on function wellness_private.admin_make_partner(uuid,text,text,text,boolean), public.admin_make_partner(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function wellness_private.admin_make_partner(uuid,text,text,text,boolean), public.admin_make_partner(uuid,text,text,text,boolean) to authenticated;

notify pgrst, 'reload schema';
