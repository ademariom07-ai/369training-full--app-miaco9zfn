-- Conteúdos dos profissionais (grátis/pago, público/meus alunos/selecionados) e grupos. Tudo é desfeito no final.
do $test$
declare
  pro uuid := gen_random_uuid(); other uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid();
  c_pub uuid; c_mine uuid; c_sel uuid; c_paid uuid; g uuid; n integer; ok boolean; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (pro,'{"full_name":"Paula Personal"}'),(other,'{"full_name":"Otto Personal"}'),(adm,'{"full_name":"Admin Teste"}'),
      (a1,'{"full_name":"Ana Aluna"}'),(a2,'{"full_name":"Bia Aluna"}'),(a3,'{"full_name":"Caio Aluno"}');
    update public.profiles set role='profissional', approved=true where id in (pro, other);
    update public.profiles set role='admin' where id = adm;
    insert into public.student_professional_links(student_id, professional_id, state, accepted_at) values (a1, pro, 'active', now()), (a2, pro, 'active', now());

    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    -- Público vai para análise; meus alunos e selecionados publicam direto.
    c_pub := public.save_content(null, 'dica', 'Dica de mobilidade', 'Para todos', 'Faça 5 minutos de mobilidade antes do treino.', null, null, null, null, 0, 'publico', null);
    if (select status from public.list_my_contents() where content_id = c_pub) <> 'em_analise' then raise exception 'public not in review'; end if; checks := checks + 1;
    c_mine := public.save_content(null, 'aula', 'Aula de postura', null, null, 'https://youtu.be/dQw4w9WgXcQ', null, null, null, 0, 'meus_alunos', null);
    c_sel := public.save_content(null, 'material', 'Plano da Ana', null, 'Só para a Ana.', null, null, null, null, 0, 'selecionados', array[a1]);
    c_paid := public.save_content(null, 'ebook', 'E-book de receitas', 'Receitas fit', 'Conteúdo do e-book', null, null, null, null, 2990, 'meus_alunos', null);
    -- Não envia para quem não é aluno ativo; não aceita link que não é do YouTube; não aceita arquivo fora da própria pasta.
    begin perform public.save_content(null, 'material', 'Para o Caio', null, 'x', null, null, null, null, 0, 'selecionados', array[a3]); raise exception 'sent to non student';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin perform public.save_content(null, 'video', 'Vídeo', null, null, 'https://vimeo.com/123', null, null, null, 0, 'meus_alunos', null); raise exception 'bad video';
    exception when invalid_parameter_value then checks := checks + 1; end;
    begin perform public.save_content(null, 'ebook', 'Arquivo', null, null, null, other::text || '/abcdefgh12.pdf', 'a.pdf', 100, 0, 'meus_alunos', null); raise exception 'foreign file path';
    exception when invalid_parameter_value then checks := checks + 1; end;
    -- Grupo de alunos.
    g := public.save_student_group(null, 'Turma da manhã', array[a1, a2]);
    if (select cardinality(members) from public.list_student_groups() where group_id = g) <> 2 then raise exception 'group'; end if; checks := checks + 1;
    begin perform public.save_student_group(null, 'Turma errada', array[a3]); raise exception 'group with non student';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- Ana vê: aula (meus alunos), plano dela (selecionados) e e-book pago bloqueado. Dica pública ainda em análise não aparece.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_contents('todos', 1) where content_id in (c_pub, c_mine, c_sel, c_paid); if n <> 3 then raise exception 'a1 sees %', n; end if; checks := checks + 1;
    select unlocked into ok from public.list_contents('para_mim', 1) where content_id = c_paid; if ok then raise exception 'paid unlocked'; end if; checks := checks + 1;
    if (select body from public.list_contents('para_mim', 1) where content_id = c_paid) is not null then raise exception 'paid body leaked'; end if; checks := checks + 1;
    if (select youtube_id from public.list_contents('para_mim', 1) where content_id = c_mine) <> 'dQw4w9WgXcQ' then raise exception 'free video'; end if; checks := checks + 1;
    -- Bia não vê o plano da Ana; Caio (sem vínculo) não vê nada dos alunos.
    perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_contents('todos', 1) where content_id = c_sel; if n <> 0 then raise exception 'a2 sees selected'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_contents('todos', 1) where content_id in (c_pub, c_mine, c_sel, c_paid); if n <> 0 then raise exception 'a3 sees'; end if; checks := checks + 1;

    -- Admin aprova a dica pública: Caio passa a ver.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    if not exists (select 1 from public.list_pending_contents() where content_id = c_pub) then raise exception 'pending list'; end if; checks := checks + 1;
    if public.review_content(c_pub, true, null) <> 'publicado' then raise exception 'approve'; end if; checks := checks + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_contents('publicos', 1) where content_id = c_pub and unlocked; if n <> 1 then raise exception 'public not visible'; end if; checks := checks + 1;
    begin perform public.review_content(c_pub, true, null); raise exception 'student reviewed';
    exception when insufficient_privilege then checks := checks + 1; end;

    -- O profissional libera o e-book pago para a Ana; não libera para o Caio (que não vê); outro profissional não libera.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.grant_content(c_paid, a1, true);
    begin perform public.grant_content(c_paid, a3, true); raise exception 'granted to non viewer';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', other, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.grant_content(c_paid, a1, true); raise exception 'other granted';
    exception when insufficient_privilege then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    if (select body from public.list_contents('para_mim', 1) where content_id = c_paid and unlocked) <> 'Conteúdo do e-book' then raise exception 'grant not applied'; end if; checks := checks + 1;

    -- Arquivar tira da lista; tabelas não são acessíveis diretamente.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    perform public.archive_content(c_sel);
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_contents('todos', 1) where content_id = c_sel; if n <> 0 then raise exception 'archived visible'; end if; checks := checks + 1;
    begin perform 1 from public.professional_contents limit 1; raise exception 'table readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 21 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '21 content checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
