-- Avaliações aluno ↔ profissional e média sem as 3 piores. Tudo é desfeito no final.
do $test$
declare
  pro uuid := gen_random_uuid(); pro2 uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
  r1 uuid; avg_v numeric; n integer; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (pro,'{"full_name":"Paula Personal"}'),(pro2,'{"full_name":"Otto Personal"}'),(adm,'{"full_name":"Admin Teste"}'),(a1,'{"full_name":"Ana Aluna"}'),(a2,'{"full_name":"Bia Aluna"}');
    update public.profiles set role='profissional', approved=true where id in (pro, pro2);
    update public.profiles set role='admin' where id = adm;
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now());
    insert into public.student_professional_links(student_id, professional_id, state, revoked_at) values (a2, pro, 'revoked', now());

    set local role authenticated;
    -- Ana (acompanhada) avalia a Paula; Bia (pedido nunca aceito) não; ninguém avalia sem vínculo.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    if not (select can_review from public.my_review_status(pro)) then raise exception 'a1 cannot review'; end if; checks := checks + 1;
    r1 := public.submit_review(pro, 5, 'Excelente acompanhamento!');
    begin perform public.submit_review(pro, 4, null); raise exception 'twice in 30 days';
    exception when program_limit_exceeded then checks := checks + 1; end;
    begin perform public.submit_review(pro2, 5, null); raise exception 'reviewed without link';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.submit_review(pro, 6, null); raise exception 'rating 6';
    exception when insufficient_privilege or program_limit_exceeded or invalid_parameter_value then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.submit_review(pro, 1, null); raise exception 'never accepted';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Profissional avalia a aluna; aluna vê a própria nota; outra aluna não vê.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.submit_review(a1, 4, 'Muito dedicada');
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    if (select average from public.review_summaries(array[a1])) <> 4 then raise exception 'student own summary'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.review_summaries(array[a1]); if n <> 0 then raise exception 'a2 sees a1 rating'; end if; checks := checks + 1;
    begin perform public.list_reviews(a1, 1); raise exception 'a2 lists a1';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Nota do profissional é pública (vitrine), com o primeiro nome de quem avaliou.
    if (select reviewer_name from public.list_reviews(pro, 1) limit 1) <> 'Ana' then raise exception 'public list'; end if; checks := checks + 1;

    -- Média: 100 mais recentes, sem as 3 piores. Notas extras inseridas direto (como service_role).
    reset role;
    insert into public.reviews (reviewer_id, reviewee_id, direction, rating, created_at)
     select a2, pro, 'aluno_profissional', case when g <= 3 then 1 else 5 end, now() - (g || ' minutes')::interval from generate_series(1, 9) g;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    -- 10 notas: três 1 e sete 5 → as três 1 caem → média 5.
    select average, counted into avg_v, n from public.review_summaries(array[pro]);
    if avg_v <> 5 or n <> 7 then raise exception 'drop 3 worst: % %', avg_v, n; end if; checks := checks + 1;
    if (select dropped from public.review_summaries(array[pro])) <> 3 then raise exception 'dropped count'; end if; checks := checks + 1;
    -- Só as 100 mais recentes entram: 100 notas 3 novas tiram as antigas.
    reset role;
    insert into public.reviews (reviewer_id, reviewee_id, direction, rating, created_at) select a2, pro, 'aluno_profissional', 3, now() + (g || ' seconds')::interval from generate_series(1, 100) g;
    set local role authenticated;
    if (select average from public.review_summaries(array[pro])) <> 3 or (select total from public.review_summaries(array[pro])) <> 110 then raise exception 'last 100'; end if; checks := checks + 1;

    -- Admin oculta; aluno não oculta.
    begin perform public.hide_review(r1, true, 'teste'); raise exception 'student hid';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.hide_review(r1, true, 'Conteúdo ofensivo');
    if not (select hidden from public.list_recent_reviews() where review_id = r1) then raise exception 'hide'; end if; checks := checks + 1;
    begin perform 1 from public.reviews limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 15 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '15 review checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
