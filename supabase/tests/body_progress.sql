-- Avaliação física e fotos de evolução. Tudo é desfeito no final.
do $test$
declare pro uuid := gen_random_uuid(); other uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
 b1 uuid; b2 uuid; f1 uuid; p text; n integer; checks integer := 0; today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (pro,'{"full_name":"Paula Personal"}'),(other,'{"full_name":"Otto"}'),(a1,'{"full_name":"Ana"}'),(a2,'{"full_name":"Bia"}');
    update public.profiles set role = 'profissional', approved = true where id in (pro, other);
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now());
    set local role authenticated;
    -- Aluna registra autoavaliação; medida absurda e vazia são recusadas.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    b1 := public.save_assessment(null, a1, today - 30, '{"weight_kg":82.5,"height_cm":168,"waist_cm":95}');
    begin perform public.save_assessment(null, a1, today, '{"weight_kg":900}'); raise exception 'absurd weight';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_assessment(null, a1, today, '{}'); raise exception 'empty';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_assessment(null, a1, today, '{"peso":80}'); raise exception 'unknown key';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Profissional ativo registra; outro profissional não vê nem registra.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    b2 := public.save_assessment(null, a1, today, '{"weight_kg":80.1,"body_fat_pct":28.5,"waist_cm":91,"notes":"Bioimpedância"}');
    select count(*) into n from public.list_assessments(a1); if n <> 2 then raise exception 'pro list %', n; end if; checks := checks + 1;
    if (select author_name from public.list_assessments(a1) where assessment_id = b1) <> 'Autoavaliação' then raise exception 'author label'; end if; checks := checks + 1;
    begin perform public.save_assessment(b1, a1, today, '{"weight_kg":70}'); raise exception 'edited other author';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.list_assessments(a1); raise exception 'other pro sees';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.save_assessment(null, a1, today, '{"weight_kg":70}'); raise exception 'other pro saves';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Fotos: aluna envia; profissional não vê até ela compartilhar.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    f1 := public.save_progress_photo(today, 'frente', a1::text || '/abcdefgh01.jpg');
    perform public.save_progress_photo(today, 'lado', a1::text || '/abcdefgh02.jpg');
    begin perform public.save_progress_photo(today, 'costas', a2::text || '/abcdefgh03.jpg'); raise exception 'foreign path';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_progress_photos(a1); if n <> 0 then raise exception 'pro sees unshared'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.set_photo_sharing(true);
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_progress_photos(a1); if n <> 2 then raise exception 'pro shared %', n; end if; checks := checks + 1;
    if not wellness_private.can_open_progress_photo(a1::text || '/abcdefgh01.jpg') then raise exception 'storage check'; end if; checks := checks + 1;
    begin perform public.save_progress_photo(today, 'frente', pro::text || '/abcdefgh09.jpg'); raise exception 'pro uploads photo';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Aluna apaga a foto e recebe o caminho do arquivo.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    p := public.delete_progress_photo(f1); if p <> a1::text || '/abcdefgh01.jpg' then raise exception 'delete path'; end if; checks := checks + 1;
    -- Outra aluna não vê nada.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.list_progress_photos(a1); raise exception 'a2 sees photos';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform 1 from public.body_assessments limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 16 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '16 body progress checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
