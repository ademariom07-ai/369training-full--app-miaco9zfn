-- Registro profissional único entre parceiros. Tudo é desfeito no final.
do $test$
declare a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); checks integer := 0;
begin
  begin
    -- Normalização: mesmo número escrito de jeitos diferentes = mesma chave; conselhos diferentes = chaves diferentes.
    if wellness_private.credential_key('CREF 012345-G/SP') <> wellness_private.credential_key('cref4/sp 12345 g') then raise exception 'cref variants'; end if; checks := checks + 1;
    if wellness_private.credential_key('CONFEF 12345') <> wellness_private.credential_key('CREF 012.345-G') then raise exception 'confef = cref'; end if; checks := checks + 1;
    if wellness_private.credential_key('CRN-3 54321') <> 'CRN:54321' then raise exception 'crn region %', wellness_private.credential_key('CRN-3 54321'); end if; checks := checks + 1;
    if wellness_private.credential_key('CREFITO 12345-F') = wellness_private.credential_key('CREF 12345-G') then raise exception 'crefito vs cref'; end if; checks := checks + 1;
    if wellness_private.credential_key('CFP 06/123456') <> wellness_private.credential_key('CRP 06/123456') then raise exception 'cfp = crp'; end if; checks := checks + 1;
    if wellness_private.credential_key('CBJJ 7788') = wellness_private.credential_key('CBJ 7788') then raise exception 'cbjj vs cbj'; end if; checks := checks + 1;
    if wellness_private.credential_key('sem número') is not null then raise exception 'no digits'; end if; checks := checks + 1;

    insert into auth.users(id, raw_user_meta_data) values (a1,'{"full_name":"Ana Personal"}'),(a2,'{"full_name":"Bia Personal"}'),(a3,'{"full_name":"Caio Personal"}'),(adm,'{"full_name":"Admin"}');
    update public.profiles set role = 'admin' where id = adm;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.submit_professional_application('educacao_fisica', 'CREF 012345-G/SP');
    -- Outra conta com o mesmo CREF (escrito diferente): bloqueia.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.submit_professional_application('educacao_fisica', 'cref 12345-G'); raise exception 'duplicate accepted';
    exception when unique_violation then checks := checks + 1; end;
    -- Mesmo número em outro conselho: permitido.
    perform public.submit_professional_application('nutricao', 'CRN 12345');
    checks := checks + 1;
    -- Admin também não consegue "tornar parceiro" com registro repetido.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.admin_make_partner(a3, 'educacao_fisica', 'CREF 12345 G/SP', 'Teste', false); raise exception 'admin duplicate';
    exception when unique_violation then checks := checks + 1; end;
    -- Pedido recusado libera o número para quem é o dono de verdade.
    perform public.review_professional_application(a1, 1, 'rejected', 'Registro não confere');
    perform public.admin_make_partner(a3, 'educacao_fisica', 'CREF 12345 G/SP', 'Conferido no CONFEF', false);
    checks := checks + 1;
    if (select count(*) from public.admin_duplicate_credentials() where applicant_id in (a1, a2, a3)) <> 0 then raise exception 'dup list'; end if; checks := checks + 1;
    reset role;
    if checks <> 12 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '12 credential checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
