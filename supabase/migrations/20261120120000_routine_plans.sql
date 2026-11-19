-- Fase 3: treino e dieta estruturados (dias da semana, exercícios com séries/repetições/vídeo; refeições com itens),
-- registro do que o aluno fez e base para planos gerados por IA.
-- Quem cria:
--  * profissional aprovado, para aluno com vínculo ATIVO: treino (educação física, fisioterapia, artes marciais)
--    e dieta (só nutrição);
--  * o próprio aluno, só treino gerado por IA (source = 'ia_aluno'). Se ele tiver profissional ativo, o plano
--    fica "em revisão" até o profissional aprovar.
-- Quem vê: o aluno, o autor do plano e o profissional com vínculo ativo com o aluno (rascunhos só o autor).
-- Os planos antigos (training_plans, texto livre) continuam como estão.

create table public.routine_plans (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('treino','dieta')),
 source text not null check (source in ('profissional','ia_profissional','ia_aluno')),
 status text not null default 'rascunho' check (status in ('rascunho','revisao','publicado','arquivado')),
 title text not null check (char_length(title) between 3 and 120),
 notes text check (notes is null or char_length(notes) between 1 and 2000),
 structure jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete set null
);
create index routine_plans_student on public.routine_plans(student_id, status, updated_at desc);
create index routine_plans_author on public.routine_plans(author_id, updated_at desc);
create table public.routine_logs (
 plan_id uuid not null references public.routine_plans(id) on delete cascade,
 day_key text not null check (day_key in ('seg','ter','qua','qui','sex','sab','dom','todos')),
 done_on date not null,
 created_at timestamptz not null default now(),
 primary key (plan_id, day_key, done_on)
);
alter table public.routine_plans enable row level security;
alter table public.routine_logs enable row level security;
revoke all on public.routine_plans, public.routine_logs from public, anon, authenticated;
grant select, insert, update, delete on public.routine_plans, public.routine_logs to service_role;
comment on table public.routine_plans is 'Treinos e dietas estruturados. Acesso só pelas funções routine_*.';

-- Valida o formato do plano (limites de tamanho e só campos conhecidos).
create function wellness_private.valid_routine(p_kind text, s jsonb) returns boolean
 language plpgsql immutable set search_path = '' as $fn$
declare d jsonb; i jsonb; keys text[] := '{}'; n integer;
begin
 if s is null or jsonb_typeof(s) <> 'object' or pg_column_size(s) > 60000 then return false; end if;
 if p_kind = 'treino' then
  if (select count(*) from jsonb_object_keys(s) k where k <> 'days') > 0 or jsonb_typeof(s->'days') <> 'array' then return false; end if;
  n := jsonb_array_length(s->'days'); if n not between 1 and 7 then return false; end if;
  for d in select * from jsonb_array_elements(s->'days') loop
   if jsonb_typeof(d) <> 'object' or (select count(*) from jsonb_object_keys(d) k where k not in ('key','name','items')) > 0 then return false; end if;
   if coalesce(d->>'key','') not in ('seg','ter','qua','qui','sex','sab','dom') or d->>'key' = any(keys) then return false; end if;
   keys := keys || (d->>'key');
   if char_length(coalesce(d->>'name','')) not between 1 and 60 or jsonb_typeof(d->'items') <> 'array' or jsonb_array_length(d->'items') not between 1 and 15 then return false; end if;
   for i in select * from jsonb_array_elements(d->'items') loop
    if jsonb_typeof(i) <> 'object' or (select count(*) from jsonb_object_keys(i) k where k not in ('name','sets','reps','rest','load','video','notes')) > 0 then return false; end if;
    if char_length(coalesce(i->>'name','')) not between 1 and 80 then return false; end if;
    if i ? 'sets' and jsonb_typeof(i->'sets') <> 'null' and (jsonb_typeof(i->'sets') <> 'number' or (i->>'sets')::numeric not between 1 and 10 or (i->>'sets')::numeric <> trunc((i->>'sets')::numeric)) then return false; end if;
    if char_length(coalesce(i->>'reps','')) > 20 or char_length(coalesce(i->>'rest','')) > 20 or char_length(coalesce(i->>'load','')) > 40 or char_length(coalesce(i->>'notes','')) > 300 then return false; end if;
    if i ? 'video' and jsonb_typeof(i->'video') <> 'null' and coalesce(i->>'video','') !~ '^[A-Za-z0-9_-]{11}$' then return false; end if;
   end loop;
  end loop;
  return true;
 elsif p_kind = 'dieta' then
  if (select count(*) from jsonb_object_keys(s) k where k <> 'meals') > 0 or jsonb_typeof(s->'meals') <> 'array' then return false; end if;
  n := jsonb_array_length(s->'meals'); if n not between 1 and 8 then return false; end if;
  for d in select * from jsonb_array_elements(s->'meals') loop
   if jsonb_typeof(d) <> 'object' or (select count(*) from jsonb_object_keys(d) k where k not in ('name','time','items')) > 0 then return false; end if;
   if char_length(coalesce(d->>'name','')) not between 1 and 60 or (d ? 'time' and jsonb_typeof(d->'time') <> 'null' and coalesce(d->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then return false; end if;
   if jsonb_typeof(d->'items') <> 'array' or jsonb_array_length(d->'items') not between 1 and 15 then return false; end if;
   for i in select * from jsonb_array_elements(d->'items') loop
    if jsonb_typeof(i) <> 'object' or (select count(*) from jsonb_object_keys(i) k where k not in ('food','qty','notes','subs')) > 0 then return false; end if;
    if char_length(coalesce(i->>'food','')) not between 1 and 80 or char_length(coalesce(i->>'qty','')) > 40 or char_length(coalesce(i->>'notes','')) > 200 or char_length(coalesce(i->>'subs','')) > 200 then return false; end if;
   end loop;
  end loop;
  return true;
 end if;
 return false;
end $fn$;
revoke all on function wellness_private.valid_routine(text, jsonb) from public, anon, authenticated;

-- Profissional com vínculo ativo com o aluno.
create function wellness_private.active_pro_of(p_student uuid) returns uuid
 language sql stable security definer set search_path = '' as $fn$
 select k.professional_id from public.student_professional_links k join public.profiles p on p.id = k.professional_id
 where k.student_id = p_student and k.state = 'active' and p.role = 'profissional' and p.approved
$fn$;
-- Área do registro profissional aprovado (educacao_fisica, nutricao, ...).
create function wellness_private.pro_area(p_pro uuid) returns text
 language sql stable security definer set search_path = '' as $fn$
 select a.specialty from public.professional_applications a where a.applicant_id = p_pro and a.status = 'approved'
$fn$;
revoke all on function wellness_private.active_pro_of(uuid), wellness_private.pro_area(uuid) from public, anon, authenticated;

-- Quem pode criar este tipo de plano para este aluno, e com qual origem.
create function wellness_private.check_routine_author(p_actor uuid, p_student uuid, p_kind text, p_source text) returns void
 language plpgsql stable security definer set search_path = '' as $fn$
declare area text;
begin
 if p_kind not in ('treino','dieta') or p_source not in ('profissional','ia_profissional','ia_aluno') then
  raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 if p_actor = p_student then
  if p_kind <> 'treino' or p_source <> 'ia_aluno' or not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'aluno') then
   raise exception using errcode = '42501', message = 'O aluno pode criar só treino sugerido pela IA.'; end if;
  return;
 end if;
 if p_source = 'ia_aluno' or wellness_private.active_pro_of(p_student) is distinct from p_actor then
  raise exception using errcode = '42501', message = 'Plano disponível só para alunos com acompanhamento ativo com você.'; end if;
 area := wellness_private.pro_area(p_actor);
 if p_kind = 'dieta' and area is distinct from 'nutricao' then
  raise exception using errcode = '42501', message = 'Dieta só pode ser prescrita por nutricionista.'; end if;
 if p_kind = 'treino' and coalesce(area,'') not in ('educacao_fisica','fisioterapia','artes_marciais') then
  raise exception using errcode = '42501', message = 'Treino só pode ser prescrito por profissional de educação física, fisioterapia ou artes marciais.'; end if;
end $fn$;
revoke all on function wellness_private.check_routine_author(uuid, uuid, text, text) from public, anon, authenticated;

-- Cria ou edita um rascunho/plano do próprio autor. Retorna o id.
create function wellness_private.save_routine(p_id uuid, p_student uuid, p_kind text, p_source text, p_title text, p_notes text, p_structure jsonb)
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_notes text := nullif(btrim(coalesce(p_notes,'')), ''); cur public.routine_plans; result uuid;
begin
 if char_length(v_title) not between 3 and 120 or char_length(coalesce(v_notes,'')) > 2000 or not wellness_private.valid_routine(p_kind, p_structure) then
  raise exception using errcode = '22023', message = 'Plano inválido: confira os campos.'; end if;
 if p_id is null then
  perform wellness_private.check_routine_author(actor, p_student, p_kind, p_source);
  if (select count(*) from public.routine_plans r where r.author_id = actor and r.created_at > now() - interval '1 day') >= 40 then
   raise exception using errcode = '54000', message = 'Limite diário de planos atingido.'; end if;
  insert into public.routine_plans (student_id, author_id, kind, source, title, notes, structure)
   values (p_student, actor, p_kind, p_source, v_title, v_notes, p_structure) returning id into result;
  return result;
 end if;
 select * into cur from public.routine_plans where id = p_id for update;
 if not found or cur.author_id <> actor or cur.status = 'arquivado' or cur.kind <> p_kind then
  raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 if cur.student_id <> actor then perform wellness_private.check_routine_author(actor, cur.student_id, cur.kind, cur.source); end if;
 update public.routine_plans set title = v_title, notes = v_notes, structure = p_structure, updated_at = now() where id = p_id;
 return p_id;
end $fn$;

-- Publica (autor). Plano de IA do aluno com profissional ativo vai para revisão.
create function wellness_private.publish_routine(p_id uuid) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); cur public.routine_plans; v_status text;
begin
 select * into cur from public.routine_plans where id = p_id for update;
 if not found or cur.author_id <> actor or cur.status not in ('rascunho','revisao') then raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 if cur.student_id <> actor then perform wellness_private.check_routine_author(actor, cur.student_id, cur.kind, cur.source); end if;
 v_status := case when cur.source = 'ia_aluno' and wellness_private.active_pro_of(cur.student_id) is not null then 'revisao' else 'publicado' end;
 -- Só um plano publicado de cada tipo por aluno: o anterior é arquivado.
 if v_status = 'publicado' then
  update public.routine_plans set status = 'arquivado', updated_at = now() where student_id = cur.student_id and kind = cur.kind and status = 'publicado' and id <> p_id;
 end if;
 update public.routine_plans set status = v_status, published_at = case when v_status = 'publicado' then now() else published_at end, updated_at = now() where id = p_id;
 return v_status;
end $fn$;

-- Profissional ativo aprova (publica) ou devolve (rascunho) um treino de IA do aluno.
create function wellness_private.review_routine(p_id uuid, p_approve boolean) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); cur public.routine_plans;
begin
 select * into cur from public.routine_plans where id = p_id for update;
 if not found or cur.status <> 'revisao' or wellness_private.active_pro_of(cur.student_id) is distinct from actor then
  raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 if p_approve then
  update public.routine_plans set status = 'arquivado', updated_at = now() where student_id = cur.student_id and kind = cur.kind and status = 'publicado';
  update public.routine_plans set status = 'publicado', published_at = now(), reviewed_by = actor, updated_at = now() where id = p_id;
  return 'publicado';
 end if;
 update public.routine_plans set status = 'rascunho', reviewed_by = actor, updated_at = now() where id = p_id;
 return 'rascunho';
end $fn$;

create function wellness_private.archive_routine(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 update public.routine_plans set status = 'arquivado', updated_at = now()
  where id = p_id and status <> 'arquivado' and (author_id = actor or student_id = actor);
 if not found then raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
end $fn$;

-- Lista: aluno vê os próprios planos (rascunhos só os que ele criou); profissional vê os que criou e os
-- planos visíveis dos alunos com vínculo ativo. p_student filtra um aluno.
create function wellness_private.list_routines(p_student uuid)
 returns table (plan_id uuid, student_id uuid, student_name text, author_id uuid, author_name text, kind text, source text, status text,
  title text, notes text, structure jsonb, updated_at timestamptz, published_at timestamptz, mine boolean, can_review boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query
 select r.id, r.student_id, s.display_name, r.author_id, case when r.source = 'ia_aluno' then 'Sugestão da IA' else a.display_name end,
  r.kind, r.source, r.status, r.title, r.notes, r.structure, r.updated_at, r.published_at, r.author_id = actor,
  r.status = 'revisao' and wellness_private.active_pro_of(r.student_id) = actor
 from public.routine_plans r join public.profiles s on s.id = r.student_id join public.profiles a on a.id = r.author_id
 where r.status <> 'arquivado' and (p_student is null or r.student_id = p_student)
  and (r.author_id = actor
   or (r.student_id = actor and r.status in ('publicado','revisao'))
   or (r.status in ('publicado','revisao') and wellness_private.active_pro_of(r.student_id) = actor))
 order by r.status = 'publicado' desc, r.updated_at desc
 limit 60;
end $fn$;

-- Aluno marca/desmarca um dia como feito (até 7 dias atrás).
create function wellness_private.log_routine_day(p_plan uuid, p_day text, p_date date, p_done boolean) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.routine_plans r where r.id = p_plan and r.student_id = actor and r.status = 'publicado') then
  raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 if p_day not in ('seg','ter','qua','qui','sex','sab','dom','todos') or p_date is null
  or p_date > (now() at time zone 'America/Sao_Paulo')::date or p_date < (now() at time zone 'America/Sao_Paulo')::date - 7 then
  raise exception using errcode = '22023', message = 'Data inválida.'; end if;
 if p_done then insert into public.routine_logs (plan_id, day_key, done_on) values (p_plan, p_day, p_date) on conflict do nothing;
 else delete from public.routine_logs where plan_id = p_plan and day_key = p_day and done_on = p_date; end if;
end $fn$;

-- Registros dos últimos 35 dias (aluno, autor ou profissional ativo).
create function wellness_private.routine_progress(p_plan uuid)
 returns table (day_key text, done_on date) language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.routine_plans r where r.id = p_plan and (r.student_id = actor or r.author_id = actor or wellness_private.active_pro_of(r.student_id) = actor)) then
  raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 return query select l.day_key, l.done_on from public.routine_logs l
  where l.plan_id = p_plan and l.done_on >= (now() at time zone 'America/Sao_Paulo')::date - 35 order by l.done_on;
end $fn$;

create function public.save_routine(p_id uuid, p_student uuid, p_kind text, p_source text, p_title text, p_notes text, p_structure jsonb) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_routine(p_id, p_student, p_kind, p_source, p_title, p_notes, p_structure)$$;
create function public.publish_routine(p_id uuid) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.publish_routine(p_id)$$;
create function public.review_routine(p_id uuid, p_approve boolean) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.review_routine(p_id, p_approve)$$;
create function public.archive_routine(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.archive_routine(p_id)$$;
create function public.list_routines(p_student uuid)
 returns table (plan_id uuid, student_id uuid, student_name text, author_id uuid, author_name text, kind text, source text, status text,
  title text, notes text, structure jsonb, updated_at timestamptz, published_at timestamptz, mine boolean, can_review boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_routines(p_student)$$;
create function public.log_routine_day(p_plan uuid, p_day text, p_date date, p_done boolean) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.log_routine_day(p_plan, p_day, p_date, p_done)$$;
create function public.routine_progress(p_plan uuid) returns table (day_key text, done_on date)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.routine_progress(p_plan)$$;

revoke all on function
 wellness_private.save_routine(uuid,uuid,text,text,text,text,jsonb), public.save_routine(uuid,uuid,text,text,text,text,jsonb),
 wellness_private.publish_routine(uuid), public.publish_routine(uuid), wellness_private.review_routine(uuid,boolean), public.review_routine(uuid,boolean),
 wellness_private.archive_routine(uuid), public.archive_routine(uuid), wellness_private.list_routines(uuid), public.list_routines(uuid),
 wellness_private.log_routine_day(uuid,text,date,boolean), public.log_routine_day(uuid,text,date,boolean),
 wellness_private.routine_progress(uuid), public.routine_progress(uuid)
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_routine(uuid,uuid,text,text,text,text,jsonb), public.save_routine(uuid,uuid,text,text,text,text,jsonb),
 wellness_private.publish_routine(uuid), public.publish_routine(uuid), wellness_private.review_routine(uuid,boolean), public.review_routine(uuid,boolean),
 wellness_private.archive_routine(uuid), public.archive_routine(uuid), wellness_private.list_routines(uuid), public.list_routines(uuid),
 wellness_private.log_routine_day(uuid,text,date,boolean), public.log_routine_day(uuid,text,date,boolean),
 wellness_private.routine_progress(uuid), public.routine_progress(uuid)
 to authenticated;
