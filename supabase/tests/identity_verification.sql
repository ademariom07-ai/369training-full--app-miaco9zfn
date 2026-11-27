-- CPF (validação, duplicidade, análise) e verificação do parceiro (etapa 2). Tudo é desfeito no final.
do $test$
declare adm uuid := gen_random_uuid(); pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); r text; checks integer := 0;
 cpf1 text := '529.982.247-25'; cpf2 text := '11144477735';
begin
  begin
    if not wellness_private.cpf_valid(cpf1) or not wellness_private.cpf_valid(cpf2) then raise exception 'valid cpf rejected'; end if; checks := checks + 1;
    if wellness_private.cpf_valid('529.982.247-24') or wellness_private.cpf_valid('111.111.111-11') or wellness_private.cpf_valid('123') then raise exception 'invalid cpf accepted'; end if; checks := checks + 1;
    insert into auth.users(id, raw_user_meta_data) values (adm,'{"full_name":"Admin"}'),(pro,'{"full_name":"Paula Personal"}'),(a1,'{"full_name":"Ana"}'),(a2,'{"full_name":"Bia"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.student_professional_links(student_id, professional_id, state) values (a2, pro, 'pending');
    set local role authenticated;
    -- Aluna 1: CPF novo → verificado na hora; só os 2 últimos dígitos aparecem.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.set_my_cpf('529.982.247-24', false); raise exception 'bad cpf';
    exception when invalid_parameter_value then checks := checks + 1; end;
    if public.set_my_cpf(cpf1, false) <> 'verificado' then raise exception 'not verified'; end if; checks := checks + 1;
    if (select cpf_masked from public.my_verification()) <> '***.***.***-25' then raise exception 'mask'; end if; checks := checks + 1;
    begin perform public.set_my_cpf(cpf2, false); raise exception 'changed verified cpf';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Aluna 2: mesmo CPF → aviso; pedindo análise → em análise; admin aprova.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.set_my_cpf('52998224725', false); raise exception 'duplicate accepted';
    exception when unique_violation then checks := checks + 1; end;
    if public.set_my_cpf('52998224725', true) <> 'em_analise' then raise exception 'review'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    if (select other_id from public.admin_list_cpf_reviews() where user_id = a2) <> a1 then raise exception 'review list'; end if; checks := checks + 1;
    perform public.admin_review_cpf(a2, true, 'Conta antiga da mesma pessoa');
    -- Parceiro: sem CPF não envia; sem verificação não aceita aluno; com fotos → em análise → admin aprova → aceita.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.submit_partner_verification(pro::text || '/aaaaaaaa1.jpg', pro::text || '/aaaaaaaa2.jpg', pro::text || '/aaaaaaaa3.jpg'); raise exception 'no cpf';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform public.set_my_cpf(cpf2, false);
    begin perform public.accept_student_link(a2, 1); raise exception 'accepted without verification';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.submit_partner_verification(a1::text || '/aaaaaaaa1.jpg', pro::text || '/aaaaaaaa2.jpg', pro::text || '/aaaaaaaa3.jpg'); raise exception 'foreign path';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform public.submit_partner_verification(pro::text || '/aaaaaaaa1.jpg', pro::text || '/aaaaaaaa2.jpg', pro::text || '/aaaaaaaa3.jpg');
    if (select partner_status from public.my_verification()) <> 'em_analise' then raise exception 'pending'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    if (select selfie_path from public.admin_list_partner_verifications() where user_id = pro) is null then raise exception 'admin list'; end if; checks := checks + 1;
    perform public.admin_review_partner(pro, true, 'Documento e CREF conferidos');
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    if (select partner_status from public.my_verification()) <> 'verificado' or (select doc_sent from public.my_verification()) then raise exception 'verified/photos kept'; end if; checks := checks + 1;
    perform public.accept_student_link(a2, 1);
    checks := checks + 1;
    if not exists (select 1 from public.verified_partners(array[pro])) then raise exception 'badge'; end if; checks := checks + 1;
    -- Aluno não vê a fila do admin.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.admin_list_cpf_reviews(); raise exception 'student sees queue';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform 1 from public.account_identity limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 19 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '19 identity checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
