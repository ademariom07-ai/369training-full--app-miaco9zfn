-- Desafios (manual, treino, hidratação) e hidratação. Tudo é desfeito no final.
do $test$
declare
  pro uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
  today date := (now() at time zone 'America/Sao_Paulo')::date; c_man uuid; c_tr uuid; c_h uuid; p1 uuid; n integer; checks integer := 0;
  treino jsonb := '{"days":[{"key":"seg","name":"A","items":[{"name":"Agachamento","sets":3,"reps":"10"}]},{"key":"ter","name":"B","items":[{"name":"Remada","sets":3,"reps":"10"}]},{"key":"qua","name":"C","items":[{"name":"Prancha","sets":3,"reps":"30s"}]},{"key":"qui","name":"D","items":[{"name":"Flexão","sets":3,"reps":"10"}]},{"key":"sex","name":"E","items":[{"name":"Afundo","sets":3,"reps":"10"}]},{"key":"sab","name":"F","items":[{"name":"Ponte","sets":3,"reps":"10"}]},{"key":"dom","name":"G","items":[{"name":"Abdominal","sets":3,"reps":"10"}]}]}';
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (pro,'{"full_name":"Paula Personal"}'),(adm,'{"full_name":"Admin Teste"}'),(a1,'{"full_name":"Ana Aluna"}'),(a2,'{"full_name":"Bia Aluna"}');
    update public.profiles set role='profissional', approved=true where id = pro;
    update public.profiles set role='admin' where id = adm;
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (pro,'Paula','educacao_fisica','CREF 1','approved',now(),'ok');
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now());

    set local role authenticated;
    -- Profissional cria desafios para os alunos dele; datas inválidas são recusadas.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    c_man := public.save_challenge(null, 'Alongar 10 minutos', 'Todo dia', 'manual', 2, today - 1, today + 5);
    c_tr := public.save_challenge(null, 'Treinar 2 vezes', null, 'treino', 2, today - 3, today + 3);
    begin perform public.save_challenge(null, 'Errado', null, 'manual', 10, today, today + 3); raise exception 'goal > window';
    exception when invalid_parameter_value then checks := checks + 1; end;
    p1 := public.save_routine(null, a1, 'treino', 'profissional', 'Semana', null, treino); perform public.publish_routine(p1);
    -- Admin cria desafio de hidratação para todos.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    c_h := public.save_challenge(null, 'Beber a meta de água', null, 'hidratacao', 1, today, today + 6);
    -- Aluno sem vínculo não vê os do profissional; vê o da equipe.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_challenges() where challenge_id in (c_man, c_tr, c_h); if n <> 1 then raise exception 'a2 sees %', n; end if; checks := checks + 1;
    begin perform public.join_challenge(c_man, true); raise exception 'a2 joined';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Ana entra nos três.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.join_challenge(c_man, true); perform public.join_challenge(c_tr, true); perform public.join_challenge(c_h, true);
    -- Manual: marca hoje e ontem; anteontem não pode.
    perform public.checkin_challenge(c_man, today, true);
    if public.checkin_challenge(c_man, today - 1, true) <> 2 then raise exception 'manual progress'; end if; checks := checks + 1;
    begin perform public.checkin_challenge(c_man, today - 2, true); raise exception 'old checkin';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.checkin_challenge(c_tr, today, true); raise exception 'checkin on auto challenge';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Treino: conta sozinho os dias com treino registrado.
    perform public.save_routine_session(p1, (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from today)::int + 1], today, 6, 0, null, '[{"name":"X","done":true}]');
    perform public.save_routine_session(p1, (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from today - 1)::int + 1], today - 1, 6, 0, null, '[{"name":"X","done":true}]');
    if (select progress from public.list_challenges() where challenge_id = c_tr) <> 2 then raise exception 'treino progress'; end if; checks := checks + 1;
    -- Hidratação: meta 2000 ml; soma copos; conta o dia quando bate a meta.
    perform public.save_hydration_settings(2000, true, 60, 8, 21);
    perform public.add_water(today, 1500);
    if (select progress from public.list_challenges() where challenge_id = c_h) <> 0 then raise exception 'water early'; end if; checks := checks + 1;
    if public.add_water(today, 500) <> 2000 then raise exception 'water total'; end if; checks := checks + 1;
    if (select progress from public.list_challenges() where challenge_id = c_h) <> 1 then raise exception 'water progress'; end if; checks := checks + 1;
    if public.add_water(today, -2000) <> 0 then raise exception 'water floor'; end if; checks := checks + 1;
    begin perform public.add_water(today + 1, 250); raise exception 'future water';
    exception when invalid_parameter_value then checks := checks + 1; end;
    if (select goal_ml from public.hydration_summary()) <> 2000 or (select jsonb_array_length(days) from public.hydration_summary()) <> 7 then raise exception 'summary'; end if; checks := checks + 1;
    -- Aluno não cria desafio.
    begin perform public.save_challenge(null, 'Meu desafio', null, 'manual', 1, today, today); raise exception 'student created';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Profissional vê o progresso dos participantes; outro aluno não.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    if (select progress from public.challenge_participants_progress(c_man) where user_id = a1) <> 2 then raise exception 'pro view'; end if; checks := checks + 1;
    if (select completed from public.list_challenges() where challenge_id = c_man) <> 1 then raise exception 'completed count'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.challenge_participants_progress(c_man); raise exception 'a2 sees participants';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform 1 from public.hydration_days limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 18 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '18 challenge checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
