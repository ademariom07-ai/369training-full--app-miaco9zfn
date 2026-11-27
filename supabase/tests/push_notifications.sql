-- Notificações push: aparelhos, preferências, fila por eventos e lembretes. Tudo é desfeito no final.
do $test$
declare pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); t uuid; plan uuid; n integer; checks integer := 0;
 ep text := 'https://push.example.invalid/' || md5(random()::text); k_p256 text := repeat('B', 87); au text := repeat('a', 22);
 treino jsonb := '{"days":[{"key":"seg","name":"A","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"ter","name":"B","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"qua","name":"C","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"qui","name":"D","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"sex","name":"E","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"sab","name":"F","items":[{"name":"X","sets":3,"reps":"10"}]},{"key":"dom","name":"G","items":[{"name":"X","sets":3,"reps":"10"}]}]}';
begin
  begin
    update wellness_private.app_settings set value = 'false' where key = 'exigir_verificacao_parceiro';
    insert into auth.users(id, raw_user_meta_data) values (pro,'{"full_name":"Paula Personal"}'),(a1,'{"full_name":"Ana"}'),(a2,'{"full_name":"Bia"}');
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (pro,'Paula','educacao_fisica','CREF 778899','approved',now(),'ok');
    set local role authenticated;
    -- Aluna cadastra o aparelho; dados inválidos recusados.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.save_push_subscription('http://inseguro', k_p256, au); raise exception 'insecure endpoint';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform public.save_push_subscription(ep, k_p256, au);
    if (select devices from public.my_push_settings()) <> 1 then raise exception 'device'; end if; checks := checks + 1;
    -- Pedido de vínculo: avisa o profissional só se ele tiver aparelho (não tem) → nada na fila dele.
    reset role;
    insert into public.student_professional_links(student_id, professional_id, state) values (a1, pro, 'pending');
    if exists (select 1 from public.push_queue where user_id = pro) then raise exception 'pro without device got push'; end if; checks := checks + 1;
    -- Aceite: aluna recebe aviso.
    update public.student_professional_links set state = 'active', accepted_at = now() where student_id = a1;
    if not exists (select 1 from public.push_queue where user_id = a1 and kind = 'vinculo') then raise exception 'accept push'; end if; checks := checks + 1;
    -- Treino publicado pelo profissional: aviso para a aluna.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    plan := public.save_routine(null, a1, 'treino', 'profissional', 'Semana 1', null, treino); perform public.publish_routine(plan);
    reset role;
    if not exists (select 1 from public.push_queue where user_id = a1 and kind = 'treino_novo') then raise exception 'routine push'; end if; checks := checks + 1;
    -- Mensagem do profissional no chat do vínculo: aviso sem o texto.
    insert into public.chat_threads (kind, member_id, professional_id) values ('vinculo', a1, pro) returning id into t;
    insert into public.chat_messages (thread_id, sender_id, body) values (t, pro, 'Segredo do treino');
    if (select body from public.push_queue where user_id = a1 and kind = 'mensagem' order by id desc limit 1) like '%Segredo%' then raise exception 'message text leaked'; end if; checks := checks + 1;
    -- Preferência desligada: não enfileira.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.save_push_prefs(false, true, true, true, true, 7);
    reset role;
    delete from public.push_queue where user_id = a1 and kind = 'mensagem';
    insert into public.chat_messages (thread_id, sender_id, body) values (t, pro, 'Outra');
    if exists (select 1 from public.push_queue where user_id = a1 and kind = 'mensagem') then raise exception 'pref ignored'; end if; checks := checks + 1;
    -- Lembrete de água: ligado, abaixo da meta, horário amplo → enfileira uma vez (não repete no intervalo).
    insert into public.hydration_settings (user_id, goal_ml, remind, every_min, from_hour, to_hour) values (a1, 2000, true, 60, 0, 24);
    perform wellness_private.push_enqueue_reminders(); perform wellness_private.push_enqueue_reminders();
    select count(*) into n from public.push_queue where user_id = a1 and kind = 'agua'; if n <> 1 then raise exception 'water %', n; end if; checks := checks + 1;
    -- Lembrete de treino na hora escolhida (todos os dias têm treino no plano).
    update public.push_prefs set treino_hora = extract(hour from now() at time zone 'America/Sao_Paulo')::int where user_id = a1 and extract(hour from now() at time zone 'America/Sao_Paulo')::int between 5 and 22;
    perform wellness_private.push_enqueue_reminders();
    if extract(hour from now() at time zone 'America/Sao_Paulo')::int between 5 and 22 and not exists (select 1 from public.push_queue where user_id = a1 and kind = 'lembrete_treino') then raise exception 'training reminder'; end if; checks := checks + 1;
    -- Envio: lote traz os avisos com o aparelho; "feito" marca enviado e remove aparelho inválido.
    if (select count(*) from public.push_worker_batch(100) where endpoint = ep) < 1 then raise exception 'batch'; end if; checks := checks + 1;
    perform public.push_worker_done((select array_agg(id) from public.push_queue where user_id = a1), array[(select id from public.push_subscriptions where endpoint = ep)], null);
    if exists (select 1 from public.push_subscriptions where endpoint = ep) or exists (select 1 from public.push_queue where user_id = a1 and sent_at is null) then raise exception 'done'; end if; checks := checks + 1;
    -- O app não acessa as funções do envio nem as tabelas.
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.push_worker_config(); raise exception 'worker exposed';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform 1 from public.push_subscriptions limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.push_test(); raise exception 'test without device';
    exception when invalid_parameter_value then checks := checks + 1; end;
    reset role;
    if checks <> 14 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '14 push checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
