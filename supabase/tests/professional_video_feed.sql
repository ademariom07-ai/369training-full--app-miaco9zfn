-- Feed de vídeos: envio só por profissional aprovado, aprovação do admin, ordem por proximidade
-- e isolamento de localização. Tudo é desfeito no bloco de exceção.
do $test$
declare
  adm uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  pc uuid := gen_random_uuid(); pd uuid := gen_random_uuid(); st uuid := gen_random_uuid();
  va uuid; vb uuid; vc uuid; vx uuid; n integer; t text; checks integer := 0;
  names text[];
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values
      (adm, '{"full_name":"Admin Teste"}'), (pa, '{"full_name":"Ana Pinheiros"}'), (pb, '{"full_name":"Bruno Campinas"}'),
      (pc, '{"full_name":"Caio Rio"}'), (pd, '{"full_name":"Dora Pendente"}'), (st, '{"full_name":"Sara Aluna"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id in (pa, pb, pc);
    update public.profiles set role = 'profissional', approved = false where id = pd;

    -- Links aceitos e recusados.
    if wellness_private.youtube_video_id('https://www.youtube.com/watch?v=dQw4w9WgXcQ') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('https://youtu.be/dQw4w9WgXcQ?si=abc') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('https://youtube.com/shorts/dQw4w9WgXcQ') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=3') <> 'dQw4w9WgXcQ' then
      raise exception 'valid youtube link rejected'; end if; checks := checks + 1;
    if wellness_private.youtube_video_id('ftp://www.youtube.com/watch?v=dQw4w9WgXcQ') is not null
     or wellness_private.youtube_video_id('https://evil.com/watch?v=dQw4w9WgXcQ') is not null
     or wellness_private.youtube_video_id('https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ') is not null
     or wellness_private.youtube_video_id('https://www.youtube.com/playlist?list=PL123') is not null then
      raise exception 'invalid youtube link accepted'; end if; checks := checks + 1;

    set local role authenticated;
    -- Aluno e profissional pendente não enviam vídeos.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    begin perform public.submit_feed_video('https://youtu.be/dQw4w9WgXcQ', 'Aquecimento', null); raise exception 'student submitted';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', pd, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    begin perform public.submit_feed_video('https://youtu.be/dQw4w9WgXcQ', 'Aquecimento', null); raise exception 'pending professional submitted';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Profissionais aprovados enviam; o vídeo nasce pendente.
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.set_my_location('sp', ' São   Paulo ', 'Pinheiros', -23.5612, -46.6934);
    select id, status into va, t from public.submit_feed_video('https://youtu.be/aaaaaaaaaaa', ' Mobilidade   de quadril ', 'Três exercícios.');
    if t <> 'pending' then raise exception 'video born published'; end if; checks := checks + 1;
    if (select title from public.feed_videos where id = va) <> 'Mobilidade de quadril' then raise exception 'title not normalized'; end if; checks := checks + 1;
    if (select lat from public.account_locations where user_id = pa) <> -23.56 then raise exception 'coordinate not rounded'; end if; checks := checks + 1;
    begin perform public.submit_feed_video('https://vimeo.com/123', 'Outro vídeo', null); raise exception 'non youtube accepted';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.submit_feed_video('https://www.youtube.com/watch?v=aaaaaaaaaaa', 'Repetido', null); raise exception 'duplicate accepted';
    exception when unique_violation then checks := checks + 1; end;
    begin perform public.review_feed_video(va, 'approved', 'ok'); raise exception 'professional reviewed';
    exception when insufficient_privilege then checks := checks + 1; end;
    select id into vx from public.submit_feed_video('https://youtu.be/xxxxxxxxxxx', 'Vou retirar', null);
    perform public.remove_feed_video(vx);
    if (select status from public.feed_videos where id = vx) <> 'removed' then raise exception 'owner remove failed'; end if; checks := checks + 1;

    perform set_config('request.jwt.claims', json_build_object('sub', pb, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.set_my_location('SP', 'Campinas', 'Cambuí', -22.9001, -47.0598);
    select id into vb from public.submit_feed_video('https://youtu.be/bbbbbbbbbbb', 'Treino de força', null);
    select count(*) into n from public.feed_videos; if n <> 1 then raise exception 'professional sees other videos'; end if; checks := checks + 1;
    begin perform public.remove_feed_video(va); raise exception 'removed other video';
    exception when insufficient_privilege then checks := checks + 1; end;

    perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select id into vc from public.submit_feed_video('https://youtu.be/ccccccccccc', 'Alongamento', null);

    -- Antes da aprovação o aluno não vê nada, nem lê a tabela direto.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select count(*) into n from public.student_video_feed(null, null, 1); if n <> 0 then raise exception 'pending video in feed'; end if; checks := checks + 1;
    select count(*) into n from public.feed_videos; if n <> 0 then raise exception 'student reads table'; end if; checks := checks + 1;

    -- Admin vê a fila e aprova.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select count(*) into n from public.list_feed_videos_for_review('pending', 1); if n <> 3 then raise exception 'queue size %', n; end if; checks := checks + 1;
    perform public.review_feed_video(va, 'approved', 'Conteúdo adequado');
    perform public.review_feed_video(vb, 'approved', 'Conteúdo adequado');
    perform public.review_feed_video(vc, 'approved', 'Conteúdo adequado');
    begin perform public.review_feed_video(va, 'rejected', 'tarde'); raise exception 'reviewed twice';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.review_feed_video(vb, 'approved', ' '); raise exception 'empty reason accepted';
    exception when invalid_parameter_value then checks := checks + 1; end;

    -- Aluno em Pinheiros/SP sem GPS: mesmo bairro, depois mesmo estado, depois os demais.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    begin perform public.set_my_location('XX', 'Lugar', null, null, null); raise exception 'invalid uf accepted';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform public.set_my_location('SP', 'sao paulo', 'PINHEIROS', null, null);
    select array_agg(professional_name || ':' || proximity order by ord) into names
     from (select professional_name, proximity, row_number() over () as ord from public.student_video_feed(null, null, 1)) f;
    if names <> array['Ana Pinheiros:bairro','Bruno Campinas:estado','Caio Rio:outras'] then raise exception 'tier order %', names; end if; checks := checks + 1;
    if exists (select 1 from public.student_video_feed(null, null, 1) where distance_km is not null) then raise exception 'distance without coordinates'; end if; checks := checks + 1;

    -- Com GPS da sessão perto de Campinas, o profissional de Campinas vem primeiro.
    select array_agg(professional_name || ':' || coalesce(distance_km::text, '-') order by ord) into names
     from (select professional_name, distance_km, row_number() over () as ord from public.student_video_feed(-22.91, -47.06, 1)) f;
    if names[1] <> 'Bruno Campinas:1' or names[2] not like 'Ana Pinheiros:%' or names[3] <> 'Caio Rio:-' then raise exception 'gps order %', names; end if; checks := checks + 1;
    if (select lat from public.account_locations where user_id = st) is not null then raise exception 'gps stored'; end if; checks := checks + 1;
    begin perform public.student_video_feed(10, 10, 1); raise exception 'coordinate outside brazil accepted';
    exception when invalid_parameter_value then checks := checks + 1; end;
    select count(*) into n from public.account_locations; if n <> 1 then raise exception 'reads other locations'; end if; checks := checks + 1;
    begin perform public.list_feed_videos_for_review('pending', 1); raise exception 'student read queue';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Admin retira um vídeo publicado; profissional que perde a aprovação some do feed.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.review_feed_video(vc, 'removed', 'Retirado a pedido');
    reset role;
    update public.profiles set approved = false where id = pb;
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select count(*) into n from public.student_video_feed(null, null, 1); if n <> 1 then raise exception 'removed or unapproved still in feed: %', n; end if; checks := checks + 1;

    -- Sessão anônima não acessa o feed.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    begin perform public.student_video_feed(null, null, 1); raise exception 'anonymous feed';
    exception when insufficient_privilege then checks := checks + 1; end;

    reset role;
    if checks <> 28 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '28 video feed checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
