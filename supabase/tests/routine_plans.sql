-- Fase 3: treino e dieta estruturados. Tudo é desfeito no final.
do $test$
declare
  ef uuid := gen_random_uuid(); nu uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  st uuid := gen_random_uuid(); solo uuid := gen_random_uuid(); p1 uuid; p2 uuid; p3 uuid; d uuid; t text; n integer; checks integer := 0;
  treino jsonb := '{"days":[{"key":"seg","name":"Treino A","items":[{"name":"Agachamento","sets":4,"reps":"10","rest":"60s","load":"20 kg","video":"dQw4w9WgXcQ","notes":""}]},{"key":"qua","name":"Treino B","items":[{"name":"Remada","sets":3,"reps":"12"}]}]}';
  dieta jsonb := '{"meals":[{"name":"Café da manhã","time":"07:00","items":[{"food":"Ovos","qty":"2 unidades","subs":"Tofu"}]}]}';
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (ef,'{"full_name":"Edu Personal"}'),(nu,'{"full_name":"Nina Nutri"}'),(other,'{"full_name":"Otto Personal"}'),(st,'{"full_name":"Sara Aluna"}'),(solo,'{"full_name":"Solo Aluno"}');
    update public.profiles set role='profissional', approved=true where id in (ef,nu,other);
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values
      (ef,'Edu','educacao_fisica','CREF 1','approved',now(),'ok'),(nu,'Nina','nutricao','CRN 1','approved',now(),'ok'),(other,'Otto','educacao_fisica','CREF 2','approved',now(),'ok');
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (st, ef, 'active', now());

    if wellness_private.valid_routine('treino', '{"days":[{"key":"seg","name":"A","items":[{"name":"X","hack":1}]}]}') then raise exception 'unknown key accepted'; end if; checks := checks + 1;
    if wellness_private.valid_routine('treino', '{"days":[{"key":"seg","name":"A","items":[{"name":"X","video":"javascript:x"}]}]}') then raise exception 'bad video accepted'; end if; checks := checks + 1;
    if wellness_private.valid_routine('dieta', '{"meals":[{"name":"A","time":"25:00","items":[{"food":"X"}]}]}') then raise exception 'bad time accepted'; end if; checks := checks + 1;

    set local role authenticated;
    -- Personal com vínculo ativo cria e publica treino; não cria dieta.
    perform set_config('request.jwt.claims', json_build_object('sub', ef, 'role','authenticated','is_anonymous',false)::text, true);
    p1 := public.save_routine(null, st, 'treino', 'profissional', 'Hipertrofia semana 1', null, treino);
    select count(*) into n from public.list_routines(st); if n <> 1 then raise exception 'author list'; end if; checks := checks + 1;
    begin perform public.save_routine(null, st, 'dieta', 'profissional', 'Dieta', null, dieta); raise exception 'personal made diet';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Aluno não vê rascunho; vê depois de publicado.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routines(null); if n <> 0 then raise exception 'student sees draft'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', ef, 'role','authenticated','is_anonymous',false)::text, true);
    if public.publish_routine(p1) <> 'publicado' then raise exception 'publish'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routines(null); if n <> 1 then raise exception 'student list'; end if; checks := checks + 1;
    -- Aluno marca o dia; não marca futuro.
    perform public.log_routine_day(p1, 'seg', (now() at time zone 'America/Sao_Paulo')::date, true);
    select count(*) into n from public.routine_progress(p1); if n <> 1 then raise exception 'log'; end if; checks := checks + 1;
    begin perform public.log_routine_day(p1, 'seg', (now() at time zone 'America/Sao_Paulo')::date + 1, true); raise exception 'future log';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Aluno não cria treino manual nem dieta; cria treino de IA, que vai para revisão (tem personal ativo).
    begin perform public.save_routine(null, st, 'treino', 'profissional', 'Meu treino', null, treino); raise exception 'student manual';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.save_routine(null, st, 'dieta', 'ia_aluno', 'Minha dieta', null, dieta); raise exception 'student diet';
    exception when insufficient_privilege then checks := checks + 1; end;
    p2 := public.save_routine(null, st, 'treino', 'ia_aluno', 'Treino da IA', null, treino);
    if public.publish_routine(p2) <> 'revisao' then raise exception 'ai not in review'; end if; checks := checks + 1;
    -- Outro personal não vê nada; o personal ativo vê e aprova.
    perform set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_routines(null); if n <> 0 then raise exception 'other pro sees'; end if; checks := checks + 1;
    begin perform public.review_routine(p2, true); raise exception 'other reviewed';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.routine_progress(p1); raise exception 'other progress';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', ef, 'role','authenticated','is_anonymous',false)::text, true);
    if not (select can_review from public.list_routines(st) where plan_id = p2) then raise exception 'cannot review'; end if; checks := checks + 1;
    if public.review_routine(p2, true) <> 'publicado' then raise exception 'review'; end if; checks := checks + 1;
    reset role;
    if (select status from public.routine_plans where id = p1) <> 'arquivado' then raise exception 'old plan kept'; end if; checks := checks + 1;
    set local role authenticated;
    -- Aluno sem profissional: treino de IA publica direto.
    perform set_config('request.jwt.claims', json_build_object('sub', solo, 'role','authenticated','is_anonymous',false)::text, true);
    p3 := public.save_routine(null, solo, 'treino', 'ia_aluno', 'Treino da IA', null, treino);
    if public.publish_routine(p3) <> 'publicado' then raise exception 'solo publish'; end if; checks := checks + 1;
    -- Nutricionista sem vínculo com o aluno não prescreve; com vínculo, prescreve dieta.
    perform set_config('request.jwt.claims', json_build_object('sub', nu, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.save_routine(null, st, 'dieta', 'profissional', 'Dieta', null, dieta); raise exception 'unlinked nutri';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    update public.student_professional_links set professional_id = nu where student_id = st;
    set local role authenticated;
    d := public.save_routine(null, st, 'dieta', 'profissional', 'Plano alimentar', 'Beba água', dieta);
    if public.publish_routine(d) <> 'publicado' then raise exception 'diet publish'; end if; checks := checks + 1;
    begin perform public.save_routine(null, st, 'treino', 'profissional', 'Treino', null, treino); raise exception 'nutri made training';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.save_routine(null, st, 'dieta', 'profissional', 'Dieta', null, '{"meals":[]}'); raise exception 'empty diet';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Sem acesso direto e sem anônimo.
    begin perform count(*) from public.routine_plans; raise exception 'direct read';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',true)::text, true);
    begin perform public.list_routines(null); raise exception 'anonymous';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 26 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '26 routine checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
