-- Fase 2: vitrine, busca e chat. Tudo é desfeito no final.
do $test$
declare
  adm uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); pp uuid := gen_random_uuid();
  st uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); th uuid; sup uuid; sup2 uuid; n integer; t text; names text[]; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (adm,'{"full_name":"Admin Teste"}'),(pa,'{"full_name":"Ana Personal"}'),
      (pb,'{"full_name":"Beto Nutri"}'),(pp,'{"full_name":"Paulo Pendente"}'),(st,'{"full_name":"Sara Aluna"}'),(s2,'{"full_name":"Tiago Aluno"}');
    update public.profiles set role='admin' where id=adm;
    update public.profiles set role='profissional', approved=true where id in (pa,pb);
    update public.profiles set role='profissional', approved=false where id=pp;
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (st, pa, 'active', now());

    set local role authenticated;
    -- Vitrine: só profissional aprovado salva; dados validados.
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.set_my_location('SP','São Paulo','Pinheiros', null, null);
    select headline into t from public.save_my_showcase(' Personal  trainer ', 'Bio', 'CREF', null, array['educacao_fisica','yoga','yoga'], array['presencial','online']);
    if t <> 'Personal trainer' then raise exception 'headline not normalized'; end if; checks := checks + 1;
    begin perform public.save_my_showcase('Ok ok', null, null, null, array['astrologia'], array['online']); raise exception 'bad modality';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', pb, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.set_my_location('RJ','Rio de Janeiro','Botafogo', null, null);
    perform public.save_my_showcase('Nutricionista esportivo', null, null, null, array['nutricao'], array['online']);
    perform set_config('request.jwt.claims', json_build_object('sub', pp, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.save_my_showcase('Pendente', null, null, null, array['yoga'], array['online']); raise exception 'pending saved';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Busca: aluno em Pinheiros vê Ana primeiro; filtros por modalidade e online; pendente não aparece.
    perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.set_my_location('SP','Sao Paulo','pinheiros', null, null);
    select array_agg(display_name || ':' || proximity order by ord) into names from (select display_name, proximity, row_number() over () ord from public.search_professionals(null,null,null,null,1)) x;
    if names <> array['Ana Personal:bairro','Beto Nutri:outras'] then raise exception 'search order %', names; end if; checks := checks + 1;
    select count(*) into n from public.search_professionals('nutricao', null, null, null, 1); if n <> 1 then raise exception 'modality filter'; end if; checks := checks + 1;
    select count(*) into n from public.search_professionals(null, 'presencial', null, null, 1); if n <> 1 then raise exception 'mode filter'; end if; checks := checks + 1;
    begin perform public.search_professionals('astrologia', null, null, null, 1); raise exception 'bad filter';
    exception when invalid_parameter_value then checks := checks + 1; end;
    select count(*) into n from public.professional_showcase(pa); if n <> 1 then raise exception 'showcase missing'; end if; checks := checks + 1;
    select count(*) into n from public.professional_showcase(pp); if n <> 0 then raise exception 'pending showcase visible'; end if; checks := checks + 1;
    select count(*) into n from public.professional_profiles; if n <> 0 then raise exception 'reads showcase table'; end if; checks := checks + 1;

    -- Chat de vínculo: aluno sem vínculo não abre; aluno com vínculo abre e conversa; outro profissional não lê.
    begin perform public.open_chat(pa); raise exception 'unlinked chat';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    th := public.open_chat(pa);
    if public.open_chat(pa) <> th then raise exception 'thread duplicated'; end if; checks := checks + 1;
    perform public.send_chat_message(th, '  Oi, Ana! ');
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role','authenticated','is_anonymous',false)::text, true);
    if (select unread from public.list_chats() where thread_id = th) <> 1 then raise exception 'unread missing'; end if; checks := checks + 1;
    if (select body from public.read_chat(th, 0)) <> 'Oi, Ana!' then raise exception 'body'; end if; checks := checks + 1;
    if (select unread from public.list_chats() where thread_id = th) <> 0 then raise exception 'not marked read'; end if; checks := checks + 1;
    perform public.send_chat_message(th, 'Olá, Sara!');
    perform set_config('request.jwt.claims', json_build_object('sub', pb, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.read_chat(th, 0); raise exception 'other pro read';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Admin não lê conversa de vínculo.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.read_chat(th, 0); raise exception 'admin read private chat';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Suporte: aluno fala com a equipe; admin abre conversa com profissional.
    perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated','is_anonymous',false)::text, true);
    sup := public.open_chat(null);
    perform public.send_chat_message(sup, 'Preciso de ajuda');
    if (select title from public.list_chats() where thread_id = sup) <> 'Equipe 369 WELLNESS' then raise exception 'support title'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    if (select title from public.list_chats() where thread_id = sup) <> 'Tiago Aluno' then raise exception 'admin sees support'; end if; checks := checks + 1;
    perform public.send_chat_message(sup, 'Claro, como posso ajudar?');
    sup2 := public.open_chat(pp);
    perform public.send_chat_message(sup2, 'Seu cadastro está em análise.');
    if exists (select 1 from public.list_chats() where thread_id = th) then raise exception 'admin lists private chat'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', s2, 'role','authenticated','is_anonymous',false)::text, true);
    if (select sender_label from public.read_chat(sup, 0) where not mine) <> 'Equipe 369 WELLNESS' then raise exception 'team label'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', pp, 'role','authenticated','is_anonymous',false)::text, true);
    if public.chat_unread_total() <> 1 then raise exception 'pending pro unread'; end if; checks := checks + 1;

    -- Vínculo encerrado: conversa fica só para leitura.
    reset role;
    update public.student_professional_links set state='revoked', revoked_at=now() where student_id = st;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.send_chat_message(th, 'Oi?'); raise exception 'sent after revoke';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.send_chat_message(sup, 'x'); raise exception 'wrote in other support';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.send_chat_message((select public.open_chat(null)), repeat('x', 2001)); raise exception 'long message';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Sem acesso direto às tabelas e sem anônimo.
    begin perform count(*) from public.chat_messages; raise exception 'direct table read';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',true)::text, true);
    begin perform public.list_chats(); raise exception 'anonymous chat';
    exception when insufficient_privilege then checks := checks + 1; end;

    reset role;
    if checks <> 27 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '27 phase 2 checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
