-- Fluxo do feed: links em mais formatos, admin publica direto como equipe, profissional segue em análise.
do $test$
declare
  adm uuid := gen_random_uuid(); pa uuid := gen_random_uuid(); st uuid := gen_random_uuid();
  v uuid; t text; n integer; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values
      (adm, '{"full_name":"Admin Teste"}'), (pa, '{"full_name":"Ana Pinheiros"}'), (st, '{"full_name":"Sara Aluna"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id = pa;

    if wellness_private.youtube_video_id('youtu.be/dQw4w9WgXcQ') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('www.youtube.com/watch?v=dQw4w9WgXcQ') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('http://YouTube.com/shorts/dQw4w9WgXcQ?feature=share') <> 'dQw4w9WgXcQ'
     or wellness_private.youtube_video_id('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=x') <> 'dQw4w9WgXcQ' then
      raise exception 'lenient link rejected'; end if; checks := checks + 1;
    if wellness_private.youtube_video_id('https://evil.com/youtu.be/dQw4w9WgXcQ') is not null
     or wellness_private.youtube_video_id('youtube.com.evil.com/watch?v=dQw4w9WgXcQ') is not null
     or wellness_private.youtube_video_id('ftp://youtu.be/dQw4w9WgXcQ') is not null then
      raise exception 'foreign link accepted'; end if; checks := checks + 1;

    set local role authenticated;
    -- Admin publica direto, com registro de quem publicou.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select id, status into v, t from public.submit_feed_video('youtu.be/aaaaaaaaaaa', 'Boas-vindas da equipe', null);
    if t <> 'approved' then raise exception 'admin video not published'; end if; checks := checks + 1;
    if (select reviewed_by from public.feed_videos where id = v) <> adm then raise exception 'publisher not recorded'; end if; checks := checks + 1;

    -- Profissional continua em análise.
    perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.set_my_location('SP', 'São Paulo', 'Pinheiros', null, null);
    select status into t from public.submit_feed_video('www.youtube.com/watch?v=bbbbbbbbbbb', 'Mobilidade', null);
    if t <> 'pending' then raise exception 'professional skipped review'; end if; checks := checks + 1;

    -- Aluno vê só o vídeo da equipe, com o nome da equipe e sem localização.
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.set_my_location('SP', 'Sao Paulo', 'Pinheiros', null, null);
    select count(*) into n from public.student_video_feed(null, null, 1); if n <> 1 then raise exception 'feed size %', n; end if; checks := checks + 1;
    if (select professional_name from public.student_video_feed(null, null, 1)) <> 'Equipe 369 WELLNESS' then raise exception 'team label missing'; end if; checks := checks + 1;
    begin perform public.submit_feed_video('youtu.be/ccccccccccc', 'Aluno', null); raise exception 'student posted';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Depois da aprovação, o vídeo do profissional do mesmo bairro vem antes do da equipe.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    perform public.review_feed_video((select video_id from public.list_feed_videos_for_review('pending', 1) limit 1), 'approved', 'ok');
    perform set_config('request.jwt.claims', json_build_object('sub', st, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    if (select professional_name from public.student_video_feed(null, null, 1) limit 1) <> 'Ana Pinheiros' then raise exception 'nearby professional not first'; end if; checks := checks + 1;

    reset role;
    if checks <> 9 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '9 video feed flow checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
