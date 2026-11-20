-- Biblioteca de exercícios: oficiais (admin), próprios (profissional), visibilidade para alunos. Tudo desfeito no final.
do $test$
declare adm uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); st uuid := gen_random_uuid(); other uuid := gen_random_uuid();
 e uuid; off_id uuid; n integer; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (adm,'{"full_name":"Admin"}'),(pa,'{"full_name":"Ana Personal"}'),(pb,'{"full_name":"Beto Personal"}'),(st,'{"full_name":"Sara"}'),(other,'{"full_name":"Outro Aluno"}');
    update public.profiles set role='admin' where id=adm;
    update public.profiles set role='profissional', approved=true where id in (pa,pb);
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (st, pa, 'active', now());
    if (select count(*) from public.exercise_library where slug is not null) <> 30 then raise exception 'seed'; end if; checks := checks + 1;
    select id into off_id from public.exercise_library where slug = 'agachamento-livre';
    set local role authenticated;
    -- Admin edita textos de um oficial e cria um oficial novo.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.save_exercise(off_id, 'Agachamento livre', array['Agachamento', 'squat'], 'Quadríceps e glúteos', 'Pés na largura dos ombros.', '[{"cues":["Quadril para trás"]},{"cues":["Segure"]},{"cues":["Suba"]}]', null, 'iniciante', 'nenhum');
    if (select phase_cues->0->'cues'->>0 from public.list_exercises() where exercise_id = off_id) <> 'Quadril para trás' then raise exception 'admin edit'; end if; checks := checks + 1;
    e := public.save_exercise(null, 'Polichinelo', null, 'Corpo todo', 'Saltos abrindo braços e pernas.', null, 'dQw4w9WgXcQ', 'iniciante', null);
    if not (select official from public.list_exercises() where exercise_id = e) then raise exception 'admin official'; end if; checks := checks + 1;
    begin perform public.archive_exercise(off_id); raise exception 'archived animated';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.save_exercise(null, 'Ruim', null, null, null, '[{"cues":[]}]', null, null, null); raise exception 'bad cues';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Profissional cria o próprio, não edita oficial.
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role','authenticated','is_anonymous',false)::text, true);
    e := public.save_exercise(null, 'Agachamento no step da Ana', array['step ana'], 'Pernas', 'Suba e desça do step.', null, null, 'iniciante', 'step');
    if not (select mine from public.list_exercises() where exercise_id = e) then raise exception 'pro own'; end if; checks := checks + 1;
    begin perform public.save_exercise(off_id, 'Hack', null, null, null, null, null, null, null); raise exception 'pro edited official';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Visibilidade: aluno da Ana vê o exercício dela; outro aluno e outro profissional não.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role','authenticated','is_anonymous',false)::text, true);
    if not exists (select 1 from public.list_exercises() where exercise_id = e) then raise exception 'student sees pro exercise'; end if; checks := checks + 1;
    begin perform public.save_exercise(null, 'Aluno cria', null, null, null, null, null, null, null); raise exception 'student created';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated','is_anonymous',false)::text, true);
    if exists (select 1 from public.list_exercises() where exercise_id = e) then raise exception 'other student sees'; end if; checks := checks + 1;
    select count(*) into n from public.list_exercises() where official; if n <> 31 then raise exception 'official count %', n; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', pb, 'role','authenticated','is_anonymous',false)::text, true);
    if exists (select 1 from public.list_exercises() where exercise_id = e) then raise exception 'other pro sees'; end if; checks := checks + 1;
    begin perform public.archive_exercise(e); raise exception 'other pro archived';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.archive_exercise(e);
    if exists (select 1 from public.list_exercises() where exercise_id = e) then raise exception 'archived listed'; end if; checks := checks + 1;
    begin perform count(*) from public.exercise_library; raise exception 'direct read';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 15 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '15 exercise library checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
