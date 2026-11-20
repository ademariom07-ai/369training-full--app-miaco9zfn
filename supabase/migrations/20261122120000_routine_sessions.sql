-- Registro do treino feito pelo aluno (o que ele fez quando treinou sozinho):
-- por exercício (feito ou não, séries, repetições e carga usadas), esforço da sessão (1 a 10),
-- dor (0 nenhuma, 1 leve, 2 forte) e um recado para o profissional.
-- Quem registra: só o aluno, num treino publicado dele, para hoje ou até 7 dias atrás.
-- Quem vê: o aluno, o autor do plano e o profissional com vínculo ativo com o aluno.
-- Cada registro também marca o dia em routine_logs, para os contadores que já existem.

create table public.routine_sessions (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.routine_plans(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 day_key text not null check (day_key in ('seg','ter','qua','qui','sex','sab','dom')),
 done_on date not null,
 effort smallint check (effort is null or effort between 1 and 10),
 pain smallint not null default 0 check (pain between 0 and 2),
 note text check (note is null or char_length(note) between 1 and 500),
 entries jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (plan_id, day_key, done_on)
);
create index routine_sessions_student on public.routine_sessions(student_id, done_on desc);
alter table public.routine_sessions enable row level security;
revoke all on public.routine_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.routine_sessions to service_role;
comment on table public.routine_sessions is 'Treinos feitos pelo aluno. Acesso só pelas funções *_routine_session(s).';

-- Valida os exercícios registrados.
create function wellness_private.valid_session_entries(e jsonb) returns boolean
 language plpgsql immutable set search_path = '' as $fn$
declare i jsonb;
begin
 if e is null or jsonb_typeof(e) <> 'array' or jsonb_array_length(e) not between 1 and 15 or pg_column_size(e) > 12000 then return false; end if;
 for i in select * from jsonb_array_elements(e) loop
  if jsonb_typeof(i) <> 'object' or (select count(*) from jsonb_object_keys(i) k where k not in ('name','done','sets','reps','load')) > 0 then return false; end if;
  if char_length(coalesce(i->>'name','')) not between 1 and 80 or jsonb_typeof(i->'done') is distinct from 'boolean' then return false; end if;
  if i ? 'sets' and jsonb_typeof(i->'sets') <> 'null' and (jsonb_typeof(i->'sets') <> 'number' or (i->>'sets')::numeric not between 0 and 10 or (i->>'sets')::numeric <> trunc((i->>'sets')::numeric)) then return false; end if;
  if char_length(coalesce(i->>'reps','')) > 20 or char_length(coalesce(i->>'load','')) > 40 then return false; end if;
 end loop;
 return true;
end $fn$;
revoke all on function wellness_private.valid_session_entries(jsonb) from public, anon, authenticated;

-- Aluno salva (cria ou substitui) o registro de um dia do treino. Retorna o id.
create function wellness_private.save_routine_session(p_plan uuid, p_day text, p_date date, p_effort integer, p_pain integer, p_note text, p_entries jsonb)
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); plan public.routine_plans; today date := (now() at time zone 'America/Sao_Paulo')::date;
 v_note text := nullif(btrim(coalesce(p_note,'')), ''); result uuid;
begin
 select * into plan from public.routine_plans r where r.id = p_plan;
 if not found or plan.student_id <> actor or plan.status <> 'publicado' or plan.kind <> 'treino' then
  raise exception using errcode = '42501', message = 'Plano indisponível.'; end if;
 if p_day is null or not exists (select 1 from jsonb_array_elements(plan.structure->'days') d where d->>'key' = p_day) then
  raise exception using errcode = '22023', message = 'Dia inválido.'; end if;
 if p_date is null or p_date > today or p_date < today - 7 then
  raise exception using errcode = '22023', message = 'Data inválida.'; end if;
 if (p_effort is not null and p_effort not between 1 and 10) or coalesce(p_pain, 0) not between 0 and 2
  or char_length(coalesce(v_note,'')) > 500 or not wellness_private.valid_session_entries(p_entries) then
  raise exception using errcode = '22023', message = 'Registro inválido: confira os campos.'; end if;
 if (select count(*) from public.routine_sessions s where s.student_id = actor and s.updated_at > now() - interval '1 day') >= 30 then
  raise exception using errcode = '54000', message = 'Limite diário de registros atingido.'; end if;
 insert into public.routine_sessions (plan_id, student_id, day_key, done_on, effort, pain, note, entries)
  values (p_plan, actor, p_day, p_date, p_effort, coalesce(p_pain, 0), v_note, p_entries)
  on conflict (plan_id, day_key, done_on) do update
   set effort = excluded.effort, pain = excluded.pain, note = excluded.note, entries = excluded.entries, updated_at = now()
  returning id into result;
 insert into public.routine_logs (plan_id, day_key, done_on) values (p_plan, p_day, p_date) on conflict do nothing;
 return result;
end $fn$;

-- Aluno apaga um registro (e desmarca o dia).
create function wellness_private.delete_routine_session(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); cur public.routine_sessions;
begin
 delete from public.routine_sessions s where s.id = p_id and s.student_id = actor returning * into cur;
 if not found then raise exception using errcode = '42501', message = 'Registro indisponível.'; end if;
 delete from public.routine_logs l where l.plan_id = cur.plan_id and l.day_key = cur.day_key and l.done_on = cur.done_on;
end $fn$;

-- Registros dos últimos 60 dias. Aluno: os próprios. Profissional: dos alunos com vínculo ativo e dos planos
-- que ele criou. p_student filtra um aluno.
create function wellness_private.list_routine_sessions(p_student uuid)
 returns table (session_id uuid, plan_id uuid, plan_title text, student_id uuid, student_name text, day_key text, day_name text,
  done_on date, effort smallint, pain smallint, note text, entries jsonb, updated_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query
 select s.id, s.plan_id, r.title, s.student_id, p.display_name, s.day_key,
  (select d->>'name' from jsonb_array_elements(r.structure->'days') d where d->>'key' = s.day_key limit 1),
  s.done_on, s.effort, s.pain, s.note, s.entries, s.updated_at
 from public.routine_sessions s join public.routine_plans r on r.id = s.plan_id join public.profiles p on p.id = s.student_id
 where (p_student is null or s.student_id = p_student)
  and s.done_on >= (now() at time zone 'America/Sao_Paulo')::date - 60
  and (s.student_id = actor or r.author_id = actor or wellness_private.active_pro_of(s.student_id) = actor)
 order by s.done_on desc, s.updated_at desc
 limit 120;
end $fn$;

create function public.save_routine_session(p_plan uuid, p_day text, p_date date, p_effort integer, p_pain integer, p_note text, p_entries jsonb) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_routine_session(p_plan, p_day, p_date, p_effort, p_pain, p_note, p_entries)$$;
create function public.delete_routine_session(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.delete_routine_session(p_id)$$;
create function public.list_routine_sessions(p_student uuid)
 returns table (session_id uuid, plan_id uuid, plan_title text, student_id uuid, student_name text, day_key text, day_name text,
  done_on date, effort smallint, pain smallint, note text, entries jsonb, updated_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_routine_sessions(p_student)$$;

revoke all on function
 wellness_private.save_routine_session(uuid,text,date,integer,integer,text,jsonb), public.save_routine_session(uuid,text,date,integer,integer,text,jsonb),
 wellness_private.delete_routine_session(uuid), public.delete_routine_session(uuid),
 wellness_private.list_routine_sessions(uuid), public.list_routine_sessions(uuid)
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_routine_session(uuid,text,date,integer,integer,text,jsonb), public.save_routine_session(uuid,text,date,integer,integer,text,jsonb),
 wellness_private.delete_routine_session(uuid), public.delete_routine_session(uuid),
 wellness_private.list_routine_sessions(uuid), public.list_routine_sessions(uuid)
 to authenticated;

notify pgrst, 'reload schema';
