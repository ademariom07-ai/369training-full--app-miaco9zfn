-- Admin: busca de usuários, suspensão/reativação de parceiro, exclusão e anonimização de contas. Tudo é desfeito no final.
do $test$
declare
  adm uuid := gen_random_uuid(); adm2 uuid := gen_random_uuid(); pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
  tag text := 'zz' || substr(md5(random()::text), 1, 8); r text; n integer; checks integer := 0;
begin
  begin
    insert into auth.users(id, email, raw_user_meta_data) values
     (adm, tag || 'adm@teste.invalid', json_build_object('full_name', 'Admin ' || tag)), (adm2, tag || 'adm2@teste.invalid', json_build_object('full_name', 'Admin2 ' || tag)),
     (pro, tag || 'pro@teste.invalid', json_build_object('full_name', 'Paula ' || tag)), (a1, tag || 'a1@teste.invalid', json_build_object('full_name', 'Ana ' || tag)),
     (a2, tag || 'a2@teste.invalid', json_build_object('full_name', 'Bia ' || tag));
    update public.profiles set role = 'admin' where id in (adm, adm2);
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (pro, 'Paula', 'educacao_fisica', 'CREF 1', 'approved', now(), 'ok');
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now());

    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Busca por nome e por e-mail.
    select count(*) into n from public.admin_list_users(tag, null, 1); if n <> 5 then raise exception 'search %', n; end if; checks := checks + 1;
    if (select email from public.admin_list_users(tag || 'a1@', null, 1)) <> tag || 'a1@teste.invalid' then raise exception 'email search'; end if; checks := checks + 1;
    select count(*) into n from public.admin_list_users(tag, 'profissional', 1); if n <> 1 then raise exception 'role filter'; end if; checks := checks + 1;

    -- Suspende e reativa o parceiro (com motivo).
    perform public.admin_set_partner(pro, false, 'Documento vencido');
    if (select approved from public.admin_list_users(tag || 'pro@', null, 1)) then raise exception 'suspend'; end if; checks := checks + 1;
    perform public.admin_set_partner(pro, true, 'Documento renovado');
    if not (select approved from public.admin_list_users(tag || 'pro@', null, 1)) then raise exception 'reactivate'; end if; checks := checks + 1;
    begin perform public.admin_set_partner(a1, true, 'Tentativa'); raise exception 'student as partner';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Exclusão: não exclui admin nem a si mesmo; exige confirmação certa e motivo.
    begin perform public.admin_delete_account(adm2, tag || 'adm2@teste.invalid', 'Teste'); raise exception 'deleted admin';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.admin_delete_account(adm, tag || 'adm@teste.invalid', 'Teste'); raise exception 'deleted self';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.admin_delete_account(a2, 'outro@email', 'Teste'); raise exception 'wrong confirm';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.admin_delete_account(a2, tag || 'a2@teste.invalid', ''); raise exception 'no reason';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Conta sem histórico: excluída de verdade.
    r := public.admin_delete_account(a2, upper(tag || 'a2@teste.invalid'), 'Pedido do usuário (LGPD)');
    if r <> 'excluida' then raise exception 'delete outcome %', r; end if; checks := checks + 1;
    reset role;
    if exists (select 1 from auth.users where id = a2) or exists (select 1 from public.profiles where id = a2) then raise exception 'not deleted'; end if; checks := checks + 1;
    -- Conta com registro que precisa ficar (plano antigo): anonimizada, e-mail liberado, vínculo encerrado.
    insert into public.training_plans (request_id, student_id, professional_id, link_version, title, content) values (gen_random_uuid(), a1, pro, 1, 'Plano antigo', 'Texto');
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    r := public.admin_delete_account(a1, 'Ana ' || tag, 'Pedido do usuário');
    if r not in ('anonimizada','anonimizada_sem_bloqueio') then raise exception 'outcome %', r; end if; checks := checks + 1;
    reset role;
    if r <> 'excluida' then
      if (select display_name from public.profiles where id = a1) <> 'Conta excluída' then raise exception 'not anonymized'; end if;
      if (select email from auth.users where id = a1) not like 'excluida-%' then raise exception 'email kept'; end if;
      if (select state from public.student_professional_links where student_id = a1) <> 'revoked' then raise exception 'link kept'; end if;
    end if;
    checks := checks + 1;
    if (select count(*) from public.admin_actions where target_id in (pro, a1, a2)) <> 4 then raise exception 'audit'; end if; checks := checks + 1;
    -- Não admin não usa nada disso.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.admin_list_users(null, null, 1); raise exception 'pro listed';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 16 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '16 admin checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
