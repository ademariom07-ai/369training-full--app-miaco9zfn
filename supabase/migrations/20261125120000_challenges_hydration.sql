-- Desafios e hidratação.
-- Desafios: criados pelo admin (para todos) ou pelo profissional aprovado (para os alunos dele). Três tipos:
--  * 'manual'     → o aluno marca cada dia cumprido (ex.: "10 minutos de alongamento");
--  * 'treino'     → conta sozinho os dias com treino registrado (routine_sessions);
--  * 'hidratacao' → conta sozinho os dias em que o aluno bateu a meta de água.
-- O desafio vale entre starts_on e ends_on; o aluno completa quando chega a goal_days dias.
-- Hidratação: o aluno soma copos de água por dia, com meta e lembretes configuráveis.

create table public.challenges (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 80),
 description text check (description is null or char_length(description) between 1 and 1000),
 kind text not null check (kind in ('manual','treino','hidratacao')),
 goal_days integer not null check (goal_days between 1 and 90),
 starts_on date not null,
 ends_on date not null,
 audience text not null check (audience in ('publico','meus_alunos')),
 status text not null default 'publicado' check (status in ('publicado','arquivado')),
 created_at timestamptz not null default now(),
 check (ends_on >= starts_on and ends_on - starts_on <= 120 and goal_days <= ends_on - starts_on + 1)
);
create index challenges_owner on public.challenges(owner_id, created_at desc);
create table public.challenge_participants (
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key (challenge_id, user_id)
);
create index challenge_participants_user on public.challenge_participants(user_id);
create table public.challenge_checkins (
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null,
 primary key (challenge_id, user_id, day)
);
create table public.hydration_days (
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null,
 ml integer not null default 0 check (ml between 0 and 10000),
 updated_at timestamptz not null default now(),
 primary key (user_id, day)
);
create table public.hydration_settings (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 goal_ml integer not null default 2500 check (goal_ml between 500 and 6000),
 remind boolean not null default false,
 every_min integer not null default 60 check (every_min between 30 and 240),
 from_hour integer not null default 8 check (from_hour between 0 and 23),
 to_hour integer not null default 21 check (to_hour between 1 and 24),
 updated_at timestamptz not null default now(),
 check (to_hour > from_hour)
);
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_checkins enable row level security;
alter table public.hydration_days enable row level security;
alter table public.hydration_settings enable row level security;
revoke all on public.challenges, public.challenge_participants, public.challenge_checkins, public.hydration_days, public.hydration_settings from public, anon, authenticated;
grant select, insert, update, delete on public.challenges, public.challenge_participants, public.challenge_checkins, public.hydration_days, public.hydration_settings to service_role;

create function wellness_private.today_sp() returns date language sql stable set search_path = '' as $fn$ select (now() at time zone 'America/Sao_Paulo')::date $fn$;
create function wellness_private.water_goal(p_user uuid) returns integer language sql stable security definer set search_path = '' as $fn$
 select coalesce((select s.goal_ml from public.hydration_settings s where s.user_id = p_user), 2500)
$fn$;
create function wellness_private.challenge_visible(c public.challenges, p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select c.owner_id = p_user or (c.status = 'publicado' and (c.audience = 'publico'
  or (c.audience = 'meus_alunos' and exists (select 1 from public.student_professional_links k where k.student_id = p_user and k.professional_id = c.owner_id and k.state = 'active'))))
$fn$;
-- Dias cumpridos por um participante dentro da janela do desafio.
create function wellness_private.challenge_progress(c public.challenges, p_user uuid) returns integer
 language sql stable security definer set search_path = '' as $fn$
 select case c.kind
  when 'manual' then (select count(*)::int from public.challenge_checkins x where x.challenge_id = c.id and x.user_id = p_user and x.day between c.starts_on and c.ends_on)
  when 'treino' then (select count(distinct s.done_on)::int from public.routine_sessions s where s.student_id = p_user and s.done_on between c.starts_on and c.ends_on)
  else (select count(*)::int from public.hydration_days h where h.user_id = p_user and h.day between c.starts_on and c.ends_on and h.ml >= wellness_private.water_goal(p_user)) end
$fn$;
revoke all on function wellness_private.today_sp(), wellness_private.water_goal(uuid), wellness_private.challenge_visible(public.challenges, uuid),
 wellness_private.challenge_progress(public.challenges, uuid) from public, anon, authenticated;

-- Cria ou edita um desafio (admin: para todos; profissional aprovado: para os alunos dele).
create function wellness_private.save_challenge(p_id uuid, p_title text, p_description text, p_kind text, p_goal_days integer, p_starts_on date, p_ends_on date)
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_role text; v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_desc text := nullif(btrim(coalesce(p_description,'')), ''); result uuid;
begin
 select case when p.role = 'admin' then 'admin' when p.role = 'profissional' and p.approved then 'profissional' end into v_role from public.profiles p where p.id = actor;
 if v_role is null then raise exception using errcode = '42501', message = 'Desafios são criados por profissionais aprovados e pela equipe.'; end if;
 if char_length(v_title) not between 3 and 80 or char_length(coalesce(v_desc,'')) > 1000 or p_kind not in ('manual','treino','hidratacao')
  or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or p_ends_on - p_starts_on > 120 or p_ends_on < wellness_private.today_sp()
  or coalesce(p_goal_days, 0) not between 1 and least(90, p_ends_on - p_starts_on + 1) then
  raise exception using errcode = '22023', message = 'Desafio inválido: confira título, datas e meta de dias.'; end if;
 if p_id is null then
  if (select count(*) from public.challenges c where c.owner_id = actor and c.created_at > now() - interval '1 day') >= 10 then
   raise exception using errcode = '54000', message = 'Limite diário de desafios atingido.'; end if;
  insert into public.challenges (owner_id, title, description, kind, goal_days, starts_on, ends_on, audience)
   values (actor, v_title, v_desc, p_kind, p_goal_days, p_starts_on, p_ends_on, case when v_role = 'admin' then 'publico' else 'meus_alunos' end) returning id into result;
 else
  update public.challenges set title = v_title, description = v_desc, kind = p_kind, goal_days = p_goal_days, starts_on = p_starts_on, ends_on = p_ends_on
   where id = p_id and owner_id = actor and status = 'publicado' returning id into result;
  if result is null then raise exception using errcode = '42501', message = 'Desafio indisponível.'; end if;
 end if;
 return result;
end $fn$;
create function wellness_private.archive_challenge(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 update public.challenges set status = 'arquivado' where id = p_id and status = 'publicado'
  and (owner_id = actor or exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin'));
 if not found then raise exception using errcode = '42501', message = 'Desafio indisponível.'; end if;
end $fn$;

-- Desafios que a pessoa vê (ativos e encerrados há até 30 dias), com participação e progresso.
create function wellness_private.list_challenges()
 returns table (challenge_id uuid, owner_name text, mine boolean, title text, description text, kind text, goal_days integer, starts_on date, ends_on date,
  joined boolean, progress integer, checked_today boolean, participants integer, completed integer)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); today date := wellness_private.today_sp();
begin
 return query
 select c.id, case when p.role = 'admin' then 'Equipe 369 WELLNESS' else p.display_name end, c.owner_id = actor, c.title, c.description, c.kind, c.goal_days, c.starts_on, c.ends_on,
  exists (select 1 from public.challenge_participants x where x.challenge_id = c.id and x.user_id = actor),
  case when exists (select 1 from public.challenge_participants x where x.challenge_id = c.id and x.user_id = actor) then wellness_private.challenge_progress(c, actor) else 0 end,
  exists (select 1 from public.challenge_checkins x where x.challenge_id = c.id and x.user_id = actor and x.day = today),
  (select count(*)::int from public.challenge_participants x where x.challenge_id = c.id),
  (select count(*)::int from public.challenge_participants x where x.challenge_id = c.id and wellness_private.challenge_progress(c, x.user_id) >= c.goal_days)
 from public.challenges c join public.profiles p on p.id = c.owner_id
 where c.status = 'publicado' and c.ends_on >= today - 30 and wellness_private.challenge_visible(c, actor)
 order by (c.ends_on >= today) desc, c.starts_on desc
 limit 50;
end $fn$;

create function wellness_private.join_challenge(p_id uuid, p_join boolean) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); c public.challenges;
begin
 select * into c from public.challenges x where x.id = p_id;
 if not found or c.status <> 'publicado' or c.owner_id = actor or not wellness_private.challenge_visible(c, actor)
  or not exists (select 1 from public.profiles p where p.id = actor and p.role = 'aluno') then
  raise exception using errcode = '42501', message = 'Desafio indisponível.'; end if;
 if p_join then
  if c.ends_on < wellness_private.today_sp() then raise exception using errcode = '22023', message = 'Este desafio já terminou.'; end if;
  insert into public.challenge_participants (challenge_id, user_id) values (p_id, actor) on conflict do nothing;
 else
  delete from public.challenge_participants where challenge_id = p_id and user_id = actor;
  delete from public.challenge_checkins where challenge_id = p_id and user_id = actor;
 end if;
end $fn$;

-- Marca (ou desmarca) um dia num desafio manual: hoje ou ontem, dentro da janela.
create function wellness_private.checkin_challenge(p_id uuid, p_day date, p_done boolean) returns integer
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); c public.challenges; today date := wellness_private.today_sp();
begin
 select * into c from public.challenges x where x.id = p_id;
 if not found or c.status <> 'publicado' or c.kind <> 'manual'
  or not exists (select 1 from public.challenge_participants x where x.challenge_id = p_id and x.user_id = actor) then
  raise exception using errcode = '42501', message = 'Desafio indisponível.'; end if;
 if p_day is null or p_day > today or p_day < today - 1 or p_day not between c.starts_on and c.ends_on then
  raise exception using errcode = '22023', message = 'Dia fora do desafio.'; end if;
 if p_done then insert into public.challenge_checkins (challenge_id, user_id, day) values (p_id, actor, p_day) on conflict do nothing;
 else delete from public.challenge_checkins where challenge_id = p_id and user_id = actor and day = p_day; end if;
 return wellness_private.challenge_progress(c, actor);
end $fn$;

-- Autor (ou admin) vê os participantes e o progresso.
create function wellness_private.challenge_participants_progress(p_id uuid)
 returns table (user_id uuid, name text, progress integer, joined_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); c public.challenges;
begin
 select * into c from public.challenges x where x.id = p_id;
 if not found or not (c.owner_id = actor or exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin')) then
  raise exception using errcode = '42501', message = 'Desafio indisponível.'; end if;
 return query select x.user_id, p.display_name, wellness_private.challenge_progress(c, x.user_id), x.joined_at
  from public.challenge_participants x join public.profiles p on p.id = x.user_id where x.challenge_id = p_id
  order by 3 desc, 4 limit 200;
end $fn$;

-- Hidratação: soma (ou tira) água no dia (hoje ou ontem). Retorna o total do dia.
create function wellness_private.add_water(p_day date, p_delta integer) returns integer
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); today date := wellness_private.today_sp(); result integer;
begin
 if p_day is null or p_day > today or p_day < today - 1 or coalesce(p_delta, 0) = 0 or p_delta not between -2000 and 2000 then
  raise exception using errcode = '22023', message = 'Registro inválido.'; end if;
 insert into public.hydration_days (user_id, day, ml) values (actor, p_day, greatest(0, least(10000, p_delta)))
  on conflict (user_id, day) do update set ml = greatest(0, least(10000, public.hydration_days.ml + p_delta)), updated_at = now()
  returning ml into result;
 return result;
end $fn$;
create function wellness_private.hydration_summary()
 returns table (goal_ml integer, remind boolean, every_min integer, from_hour integer, to_hour integer, days jsonb)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); today date := wellness_private.today_sp();
begin
 return query select coalesce(s.goal_ml, 2500), coalesce(s.remind, false), coalesce(s.every_min, 60), coalesce(s.from_hour, 8), coalesce(s.to_hour, 21),
  coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'ml', coalesce(h.ml, 0)) order by d.day)
   from generate_series(today - 6, today, interval '1 day') g(dt) cross join lateral (select g.dt::date as day) d
   left join public.hydration_days h on h.user_id = actor and h.day = d.day), '[]'::jsonb)
 from (select 1) one left join public.hydration_settings s on s.user_id = actor;
end $fn$;
create function wellness_private.save_hydration_settings(p_goal_ml integer, p_remind boolean, p_every_min integer, p_from_hour integer, p_to_hour integer) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if coalesce(p_goal_ml, 0) not between 500 and 6000 or coalesce(p_every_min, 0) not between 30 and 240
  or coalesce(p_from_hour, -1) not between 0 and 23 or coalesce(p_to_hour, -1) not between 1 and 24 or p_to_hour <= p_from_hour then
  raise exception using errcode = '22023', message = 'Configuração inválida.'; end if;
 insert into public.hydration_settings (user_id, goal_ml, remind, every_min, from_hour, to_hour) values (actor, p_goal_ml, coalesce(p_remind, false), p_every_min, p_from_hour, p_to_hour)
  on conflict (user_id) do update set goal_ml = excluded.goal_ml, remind = excluded.remind, every_min = excluded.every_min,
   from_hour = excluded.from_hour, to_hour = excluded.to_hour, updated_at = now();
end $fn$;

create function public.save_challenge(p_id uuid, p_title text, p_description text, p_kind text, p_goal_days integer, p_starts_on date, p_ends_on date) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_challenge(p_id, p_title, p_description, p_kind, p_goal_days, p_starts_on, p_ends_on)$$;
create function public.archive_challenge(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.archive_challenge(p_id)$$;
create function public.list_challenges()
 returns table (challenge_id uuid, owner_name text, mine boolean, title text, description text, kind text, goal_days integer, starts_on date, ends_on date,
  joined boolean, progress integer, checked_today boolean, participants integer, completed integer)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_challenges()$$;
create function public.join_challenge(p_id uuid, p_join boolean) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.join_challenge(p_id, p_join)$$;
create function public.checkin_challenge(p_id uuid, p_day date, p_done boolean) returns integer
 language sql security invoker set search_path = '' as $$select wellness_private.checkin_challenge(p_id, p_day, p_done)$$;
create function public.challenge_participants_progress(p_id uuid) returns table (user_id uuid, name text, progress integer, joined_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.challenge_participants_progress(p_id)$$;
create function public.add_water(p_day date, p_delta integer) returns integer
 language sql security invoker set search_path = '' as $$select wellness_private.add_water(p_day, p_delta)$$;
create function public.hydration_summary() returns table (goal_ml integer, remind boolean, every_min integer, from_hour integer, to_hour integer, days jsonb)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.hydration_summary()$$;
create function public.save_hydration_settings(p_goal_ml integer, p_remind boolean, p_every_min integer, p_from_hour integer, p_to_hour integer) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.save_hydration_settings(p_goal_ml, p_remind, p_every_min, p_from_hour, p_to_hour)$$;

revoke all on function
 wellness_private.save_challenge(uuid,text,text,text,integer,date,date), public.save_challenge(uuid,text,text,text,integer,date,date),
 wellness_private.archive_challenge(uuid), public.archive_challenge(uuid), wellness_private.list_challenges(), public.list_challenges(),
 wellness_private.join_challenge(uuid,boolean), public.join_challenge(uuid,boolean), wellness_private.checkin_challenge(uuid,date,boolean), public.checkin_challenge(uuid,date,boolean),
 wellness_private.challenge_participants_progress(uuid), public.challenge_participants_progress(uuid),
 wellness_private.add_water(date,integer), public.add_water(date,integer), wellness_private.hydration_summary(), public.hydration_summary(),
 wellness_private.save_hydration_settings(integer,boolean,integer,integer,integer), public.save_hydration_settings(integer,boolean,integer,integer,integer)
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_challenge(uuid,text,text,text,integer,date,date), public.save_challenge(uuid,text,text,text,integer,date,date),
 wellness_private.archive_challenge(uuid), public.archive_challenge(uuid), wellness_private.list_challenges(), public.list_challenges(),
 wellness_private.join_challenge(uuid,boolean), public.join_challenge(uuid,boolean), wellness_private.checkin_challenge(uuid,date,boolean), public.checkin_challenge(uuid,date,boolean),
 wellness_private.challenge_participants_progress(uuid), public.challenge_participants_progress(uuid),
 wellness_private.add_water(date,integer), public.add_water(date,integer), wellness_private.hydration_summary(), public.hydration_summary(),
 wellness_private.save_hydration_settings(integer,boolean,integer,integer,integer), public.save_hydration_settings(integer,boolean,integer,integer,integer)
 to authenticated;

notify pgrst, 'reload schema';
