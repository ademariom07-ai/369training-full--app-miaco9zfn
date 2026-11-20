-- Registro do treino feito pelo aluno. Tudo é desfeito no final.
do $test$
declare
  ef uuid := gen_random_uuid(); other uuid := gen_random_uuid(); st uuid := gen_random_uuid(); st2 uuid := gen_random_uuid();
  p1 uuid; s1 uuid; s2 uuid; n integer; checks integer := 0; today date := (now() at time zone 'America/Sao_Paulo')::date;
  treino jsonb := '{"days":[{"key":"seg","name":"Treino A","items":[{"name":"Agachamento","sets":4,"reps":"10","load":"20 kg"}]},{"key":"qua","name":"Treino B","items":[{"name":"Remada","sets":3,"reps":"12"}]}]}';
  feito jsonb := '[{"name":"Agachamento","done":true,"sets":4,"reps":"10","load":"22 kg"}]';
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (ef,'{"full_name":"Edu Personal"}'),(other,'{"full_name":"Otto Personal"}'),(st,'{"full_name":"Sara Aluna"}'),(st2,'{"full_name":"Beto Aluno"}');
    update public.profiles set role='profissional', approved=true where id in (ef,other);
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values
      (ef,'Edu','educacao_fisica','CREF 1','approved',now(),'ok'),(other,'Otto','educacao_fisica','CREF 2','approved',now(),'ok');
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (st, ef, 'active', now());

    if wellness_private.valid_session_entries('[{"name":"X","done":true,"hack":1}]') then raise exception 'unknown key'; end if; checks := checks + 1;
    if wellness_private.valid_session_entries('[{"name":"X","done":"sim"}]') then raise exception 'done not boolean'; end if; checks := checks + 1;
    if wellness_private.valid_session_entries('[]') then raise exception 'empty entries'; end if; checks := checks + 1;

    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', ef, 'role','authenticated','is_anonymous',false)::text, true);
    p1 := public.save_routine(null, st, 'treino', 'profissional', 'Semana 1', null, treino);
    perform public.publish_routine(p1);
    -- O profissional não registra pelo aluno.
    begin perform public.save_routine_session(p1, 'seg', today, 7, 0, null, feito); raise exception 'pro logged';
    exception when insufficient_privilege then checks := checks + 1; end;

    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    s1 := public.save_routine_session(p1, 'seg', today, 7, 1, 'Senti um pouco a lombar', feito);
    -- Salvar de novo o mesmo dia substitui (não duplica).
    s2 := public.save_routine_session(p1, 'seg', today, 8, 1, 'Senti um pouco a lombar', feito);
    if s1 <> s2 then raise exception 'duplicated session'; end if; checks := checks + 1;
    select count(*) into n from public.routine_progress(p1) where day_key = 'seg' and done_on = today; if n <> 1 then raise exception 'day not marked'; end if; checks := checks + 1;
    perform public.save_routine_session(p1, 'qua', today - 3, null, 0, null, '[{"name":"Remada","done":false}]');
    begin perform public.save_routine_session(p1, 'sex', today, 5, 0, null, feito); raise exception 'day not in plan';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_routine_session(p1, 'seg', today + 1, 5, 0, null, feito); raise exception 'future';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_routine_session(p1, 'seg', today - 8, 5, 0, null, feito); raise exception 'too old';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_routine_session(p1, 'seg', today, 11, 0, null, feito); raise exception 'effort 11';
    exception when invalid_parameter_value then checks := checks + 1; end;
    select count(*) into n from public.list_routine_sessions(null); if n <> 2 then raise exception 'student list %', n; end if; checks := checks + 1;

    -- O profissional ativo vê o que o aluno fez, com esforço, dor e recado.
    perform set_config('request.jwt.claims', json_build_object('sub', ef, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routine_sessions(st) where effort = 8 and pain = 1 and note like 'Senti%' and day_name = 'Treino A' and plan_title = 'Semana 1';
    if n <> 1 then raise exception 'pro view'; end if; checks := checks + 1;
    select count(*) into n from public.list_routine_sessions(null); if n <> 2 then raise exception 'pro all list'; end if; checks := checks + 1;
    begin perform public.delete_routine_session(s1); raise exception 'pro deleted';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Outro profissional e outro aluno não veem nada.
    perform set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routine_sessions(st); if n <> 0 then raise exception 'other pro sees'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', st2, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routine_sessions(null); if n <> 0 then raise exception 'other student sees'; end if; checks := checks + 1;
    begin perform public.save_routine_session(p1, 'seg', today, 5, 0, null, feito); raise exception 'other student logged';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- O aluno apaga o registro e o dia é desmarcado.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.delete_routine_session(s1);
    select count(*) into n from public.routine_progress(p1) where day_key = 'seg' and done_on = today; if n <> 0 then raise exception 'day kept'; end if; checks := checks + 1;

    -- Sem acesso direto à tabela.
    begin perform 1 from public.routine_sessions limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 19 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '19 session checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
