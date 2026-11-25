-- Autoexclusão da conta (aluno/parceiro). Tudo é desfeito no final.
do $test$
declare
  adm uuid := gen_random_uuid(); pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
  tag text := 'zy' || substr(md5(random()::text), 1, 8); r text; checks integer := 0;
begin
  begin
    insert into auth.users(id, email, raw_user_meta_data) values (adm, tag || 'adm@teste.invalid', '{"full_name":"Admin"}'),(pro, tag || 'pro@teste.invalid', '{"full_name":"Paula"}'),
     (a1, tag || 'a1@teste.invalid', '{"full_name":"Ana"}'),(a2, tag || 'a2@teste.invalid', '{"full_name":"Bia"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now());
    insert into public.training_plans (request_id, student_id, professional_id, link_version, title, content) values (gen_random_uuid(), a1, pro, 1, 'Plano antigo', 'Texto');

    set local role authenticated;
    -- Confirmação errada não exclui; admin não se autoexclui.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.delete_my_account('outro@email', null); raise exception 'wrong confirm';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.delete_my_account(tag || 'adm@teste.invalid', null); raise exception 'admin self delete';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Aluna sem histórico: apagada.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    r := public.delete_my_account(upper(tag || 'a2@teste.invalid'), 'Não uso mais');
    if r <> 'excluida' then raise exception 'outcome %', r; end if; checks := checks + 1;
    reset role;
    if exists (select 1 from public.profiles where id = a2) then raise exception 'kept'; end if; checks := checks + 1;
    -- Aluna com plano antigo: anonimizada.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    r := public.delete_my_account(tag || 'a1@teste.invalid', null);
    if r not in ('anonimizada','anonimizada_sem_bloqueio') then raise exception 'outcome2 %', r; end if; checks := checks + 1;
    reset role;
    if (select display_name from public.profiles where id = a1) <> 'Conta excluída' then raise exception 'not anonymized'; end if; checks := checks + 1;
    if (select count(*) from public.admin_actions where target_id in (a1, a2) and action in ('autoexclusao','autoexclusao_anonimizada')) <> 2 then raise exception 'audit'; end if; checks := checks + 1;
    -- Exclusão pelo admin continua funcionando com a função compartilhada.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    if public.admin_delete_account(pro, tag || 'pro@teste.invalid', 'Teste admin') not in ('excluida','anonimizada','anonimizada_sem_bloqueio') then raise exception 'admin delete'; end if; checks := checks + 1;
    reset role;
    if checks <> 8 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '8 self-delete checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
