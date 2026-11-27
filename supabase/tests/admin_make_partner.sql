-- Admin torna parceiro: sem pedido, com pedido pendente, com pedido recusado e com vínculo de aluno. Tudo é desfeito no final.
do $test$
declare
  adm uuid := gen_random_uuid(); pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid(); checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (adm,'{"full_name":"Admin"}'),(pro,'{"full_name":"Paula"}'),(a1,'{"full_name":"Ana"}'),(a2,'{"full_name":"Bia"}'),(a3,'{"full_name":"Caio"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (pro,'Paula','educacao_fisica','CREF 1','approved',now(),'ok');
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential) values (a2,'Bia','nutricao','CRN 2');
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (a3,'Caio','fisioterapia','CREFITO 3','rejected',now(),'faltou documento');
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a2, pro, 'active', now());

    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Sem pedido: precisa de área e registro.
    begin perform public.admin_make_partner(a1, null, null, 'Conferido', false); raise exception 'no data';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform public.admin_make_partner(a1, 'educacao_fisica', 'CREF 123456-G/SP', 'Documento conferido', false);
    reset role;
    if not exists (select 1 from public.profiles where id = a1 and role = 'profissional' and approved) then raise exception 'a1 not partner'; end if; checks := checks + 1;
    set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Pedido pendente com vínculo de aluno: bloqueia sem a opção; aprova com ela e encerra o vínculo.
    begin perform public.admin_make_partner(a2, null, null, 'Conferido', false); raise exception 'link not blocked';
    exception when unique_violation then checks := checks + 1; end;
    perform public.admin_make_partner(a2, null, null, 'Conferido', true);
    reset role;
    if (select state from public.student_professional_links where student_id = a2) <> 'revoked' then raise exception 'link kept'; end if; checks := checks + 1;
    set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    reset role;
    if (select specialty from public.professional_applications where applicant_id = a2) <> 'nutricao' then raise exception 'specialty lost'; end if; checks := checks + 1;
    set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Pedido recusado: vira aprovado.
    perform public.admin_make_partner(a3, null, 'CREFITO 3-SP', 'Documento enviado', false);
    reset role;
    if (select status from public.professional_applications where applicant_id = a3) <> 'approved' then raise exception 'rejected not approved'; end if; checks := checks + 1;
    set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Já parceiro e o próprio admin não.
    begin perform public.admin_make_partner(pro, null, null, 'x yz', false); raise exception 'already partner';
    exception when unique_violation then checks := checks + 1; end;
    begin perform public.admin_make_partner(adm, 'educacao_fisica', 'X', 'x yz', false); raise exception 'self';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if (select count(*) from public.admin_actions where target_id in (a1, a2, a3) and action = 'aprovar_parceiro') <> 3 then raise exception 'audit'; end if; checks := checks + 1;
    set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    -- Não admin não aprova.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.admin_make_partner(a1, 'educacao_fisica', 'X', 'x yz', false); raise exception 'pro approved';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 10 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '10 make-partner checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
