-- Radar 369: acesso só de parceiros/admin, gravação pelo worker, ocultar e notas. Tudo é desfeito no final.
do $test$
declare adm uuid := gen_random_uuid(); pro uuid := gen_random_uuid(); a1 uuid := gen_random_uuid(); n integer; item uuid; checks integer := 0;
 items jsonb := '[{"specialty":"educacao_fisica","pmid":"39990001","title_original":"Resistance training volume and hypertrophy: a meta-analysis","title_pt":"Volume de treino de força e hipertrofia","journal":"Sports Med","pub_year":"2026","evidence":"metanalise","summary_pt":"Mais séries semanais tendem a aumentar a hipertrofia até certo ponto.","practice_pt":"Planeje 10 a 20 séries por grupo muscular por semana.","content_idea_pt":"Post: quantas séries por semana?"},
  {"specialty":"educacao_fisica","pmid":"39990001","title_original":"dup","title_pt":"dup","evidence":"metanalise","summary_pt":"Repetido, não deve entrar."},
  {"specialty":"nutricao","pmid":"39990002","title_original":"Protein distribution trial","title_pt":"Distribuição de proteína","journal":"Nutrients","pub_year":"2026","evidence":"ensaio_clinico","summary_pt":"Dividir a proteína ao longo do dia ajudou a síntese muscular."},
  {"specialty":"nutricao","pmid":"abc","title_original":"x","title_pt":"x","evidence":"estudo","summary_pt":"PMID inválido, não entra."}]';
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (adm,'{"full_name":"Admin"}'),(pro,'{"full_name":"Paula"}'),(a1,'{"full_name":"Ana"}');
    update public.profiles set role = 'admin' where id = adm;
    update public.profiles set role = 'profissional', approved = true where id = pro;
    insert into public.professional_applications(applicant_id, applicant_name, specialty, credential, status, reviewed_at, review_reason) values (pro,'Paula','educacao_fisica','CREF 445566','approved',now(),'ok');
    -- Worker grava (só os válidos e sem repetir).
    if public.radar_worker_save(items) <> 2 then raise exception 'save count'; end if; checks := checks + 1;
    if not exists (select 1 from public.radar_worker_known('educacao_fisica') where pmid = '39990001') then raise exception 'known'; end if; checks := checks + 1;
    set local role authenticated;
    -- Parceiro: área padrão e lista filtrada com link do PubMed.
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    if public.radar_my_specialty() <> 'educacao_fisica' then raise exception 'my specialty'; end if; checks := checks + 1;
    if (select url from public.list_radar('educacao_fisica', 1) where kind = 'estudo' and title_original like 'Resistance%') <> 'https://pubmed.ncbi.nlm.nih.gov/39990001/' then raise exception 'url'; end if; checks := checks + 1;
    select count(*) into n from public.list_radar('educacao_fisica', 1) where kind = 'estudo' and title_original in ('Resistance training volume and hypertrophy: a meta-analysis','Protein distribution trial'); if n <> 1 then raise exception 'filter %', n; end if; checks := checks + 1;
    begin perform public.admin_hide_radar((select item_id from public.list_radar('educacao_fisica', 1) where title_original like 'Resistance%'), true); raise exception 'pro hid';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Aluno não vê o Radar.
    perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role','authenticated','is_anonymous',false)::text, true);
    begin perform public.list_radar(null, 1); raise exception 'student sees radar';
    exception when insufficient_privilege then checks := checks + 1; end;
    -- Admin oculta um estudo e publica nota para todas as áreas.
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role','authenticated','is_anonymous',false)::text, true);
    select item_id into item from public.list_radar('nutricao', 1) where title_original = 'Protein distribution trial';
    perform public.admin_hide_radar(item, true);
    perform public.admin_save_radar_note('todas', 'Nota do CONFEF', 'Nova resolução sobre registro eletrônico.', 'https://www.confef.org.br/');
    begin perform public.admin_save_radar_note('todas', 'Link ruim', 'Texto da nota.', 'http://inseguro'); raise exception 'insecure url';
    exception when invalid_parameter_value then checks := checks + 1; end;
    perform set_config('request.jwt.claims', json_build_object('sub', pro, 'role','authenticated','is_anonymous',false)::text, true);
    select count(*) into n from public.list_radar('nutricao', 1) where title_original = 'Protein distribution trial'; if n <> 0 then raise exception 'hidden visible'; end if; checks := checks + 1;
    if not exists (select 1 from public.list_radar('educacao_fisica', 1) where kind = 'nota' and title = 'Nota do CONFEF') then raise exception 'note'; end if; checks := checks + 1;
    begin perform public.radar_worker_save('[]'); raise exception 'worker exposed';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 11 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '11 radar checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
