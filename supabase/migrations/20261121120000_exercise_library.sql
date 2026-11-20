-- Biblioteca de exercícios no banco:
-- * exercícios OFICIAIS 369 (owner_id nulo): editados só pelo admin. Os 30 com animação no app têm "slug"
--   (o desenho continua no app; aqui ficam nome, apelidos, músculos, como executar, dicas por fase e vídeo);
-- * exercícios PRÓPRIOS de profissionais aprovados: visíveis ao profissional e aos alunos dele (pedido ou ativo).
-- Acesso só pelas funções abaixo.

create table public.exercise_library (
 id uuid primary key default gen_random_uuid(),
 slug text unique check (slug is null or slug ~ '^[a-z0-9-]{3,60}$'),
 owner_id uuid references public.profiles(id) on delete cascade,
 name text not null check (char_length(name) between 3 and 80),
 aliases text[] not null default '{}' check (cardinality(aliases) <= 15),
 muscles text check (muscles is null or char_length(muscles) <= 300),
 instructions text check (instructions is null or char_length(instructions) <= 1500),
 phase_cues jsonb,
 video text check (video is null or video ~ '^[A-Za-z0-9_-]{11}$'),
 level text check (level is null or level in ('iniciante','intermediario','avancado')),
 equipment text check (equipment is null or char_length(equipment) <= 80),
 status text not null default 'ativo' check (status in ('ativo','arquivado')),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null,
 check (slug is null or owner_id is null)
);
create unique index exercise_library_official_name on public.exercise_library (lower(name)) where owner_id is null and status = 'ativo';
create unique index exercise_library_owner_name on public.exercise_library (owner_id, lower(name)) where owner_id is not null and status = 'ativo';
alter table public.exercise_library enable row level security;
revoke all on public.exercise_library from public, anon, authenticated;
grant select, insert, update, delete on public.exercise_library to service_role;
comment on table public.exercise_library is 'Biblioteca de exercícios (oficial 369 e dos profissionais). Acesso só pelas funções list/save/archive_exercise.';

insert into public.exercise_library (slug, name, muscles, level) values
 ('remada-curvada-barra','Remada curvada com barra','Latíssimo do dorso, trapézio médio, romboides, deltoide posterior e bíceps','intermediario'),
 ('agachamento-livre','Agachamento livre','Quadríceps, glúteo máximo, posteriores de coxa e core','iniciante'),
 ('flexao-de-braco','Flexão de braço','Peitoral maior, deltoide anterior, tríceps e core','iniciante'),
 ('elevacao-de-quadril','Elevação de quadril (ponte)','Glúteo máximo, posteriores de coxa e core','iniciante'),
 ('agachamento-barra','Agachamento com barra','Quadríceps, glúteo máximo, posteriores de coxa, eretores da coluna e core','intermediario'),
 ('agachamento-goblet','Agachamento goblet com halter','Quadríceps, glúteo máximo, adutores e core','iniciante'),
 ('afundo','Afundo (avanço)','Quadríceps, glúteo máximo, posteriores de coxa e panturrilha','iniciante'),
 ('levantamento-terra','Levantamento terra','Glúteo máximo, posteriores de coxa, eretores da coluna, quadríceps e trapézio','intermediario'),
 ('stiff-barra','Stiff com barra','Posteriores de coxa, glúteo máximo e eretores da coluna','intermediario'),
 ('panturrilha-em-pe','Panturrilha em pé','Gastrocnêmio e sóleo','iniciante'),
 ('cadeira-extensora','Cadeira extensora','Quadríceps (reto femoral e vastos)','iniciante'),
 ('mesa-flexora','Mesa flexora','Posteriores de coxa (bíceps femoral, semitendíneo, semimembranáceo) e panturrilha','iniciante'),
 ('leg-press-45','Leg press 45°','Quadríceps, glúteo máximo e posteriores de coxa','iniciante'),
 ('elevacao-pelvica-barra','Elevação pélvica com barra','Glúteo máximo, posteriores de coxa e core','intermediario'),
 ('supino-reto-barra','Supino reto com barra','Peitoral maior, deltoide anterior e tríceps','intermediario'),
 ('supino-reto-halteres','Supino reto com halteres','Peitoral maior, deltoide anterior e tríceps','iniciante'),
 ('supino-inclinado-halteres','Supino inclinado com halteres','Peitoral maior (porção superior), deltoide anterior e tríceps','intermediario'),
 ('flexao-inclinada','Flexão inclinada (mãos no banco)','Peitoral maior, deltoide anterior, tríceps e core','iniciante'),
 ('remada-curvada-halteres','Remada curvada com halteres','Latíssimo do dorso, trapézio médio, romboides, deltoide posterior e bíceps','iniciante'),
 ('puxada-frontal','Puxada frontal no pulley','Latíssimo do dorso, redondo maior, bíceps e trapézio inferior','iniciante'),
 ('remada-baixa','Remada baixa no cabo','Latíssimo do dorso, romboides, trapézio médio e bíceps','iniciante'),
 ('superman','Superman (extensão lombar no solo)','Eretores da coluna, glúteo máximo e deltoide posterior','iniciante'),
 ('desenvolvimento-halteres','Desenvolvimento com halteres (sentado)','Deltoide anterior e médio, tríceps e trapézio superior','iniciante'),
 ('elevacao-frontal','Elevação frontal com halteres','Deltoide anterior e peitoral maior (porção clavicular)','iniciante'),
 ('rosca-direta-halteres','Rosca direta com halteres','Bíceps braquial, braquial e braquiorradial','iniciante'),
 ('triceps-frances','Tríceps francês com halter','Tríceps braquial (cabeça longa)','iniciante'),
 ('triceps-testa','Tríceps testa com barra','Tríceps braquial','intermediario'),
 ('prancha','Prancha','Reto do abdômen, transverso do abdômen, oblíquos e glúteos','iniciante'),
 ('abdominal-crunch','Abdominal (crunch)','Reto do abdômen e oblíquos','iniciante'),
 ('elevacao-de-pernas','Elevação de pernas','Reto do abdômen (porção inferior), iliopsoas e oblíquos','intermediario');

-- Dicas por fase: lista (até 8 fases) de objetos {"cues": [até 3 textos de 1 a 90 caracteres]}.
create function wellness_private.valid_phase_cues(c jsonb) returns boolean
 language plpgsql immutable set search_path = '' as $fn$
declare ph jsonb; t jsonb;
begin
 if c is null then return true; end if;
 if jsonb_typeof(c) <> 'array' or jsonb_array_length(c) > 8 then return false; end if;
 for ph in select * from jsonb_array_elements(c) loop
  if jsonb_typeof(ph) <> 'object' or (select count(*) from jsonb_object_keys(ph) k where k <> 'cues') > 0
   or jsonb_typeof(ph->'cues') <> 'array' or jsonb_array_length(ph->'cues') not between 1 and 3 then return false; end if;
  for t in select * from jsonb_array_elements(ph->'cues') loop
   if jsonb_typeof(t) <> 'string' or char_length(btrim(t #>> '{}')) not between 1 and 90 then return false; end if;
  end loop;
 end loop;
 return true;
end $fn$;
revoke all on function wellness_private.valid_phase_cues(jsonb) from public, anon, authenticated;

create function wellness_private.list_exercises()
 returns table (exercise_id uuid, slug text, owner_id uuid, owner_name text, name text, aliases text[], muscles text, instructions text,
  phase_cues jsonb, video text, level text, equipment text, official boolean, mine boolean, updated_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); my_pro uuid;
begin
 select k.professional_id into my_pro from public.student_professional_links k where k.student_id = actor and k.state in ('pending','active');
 return query
 select e.id, e.slug, e.owner_id, p.display_name, e.name, e.aliases, e.muscles, e.instructions, e.phase_cues, e.video, e.level, e.equipment,
  e.owner_id is null, e.owner_id = actor, e.updated_at
 from public.exercise_library e left join public.profiles p on p.id = e.owner_id
 where e.status = 'ativo' and (e.owner_id is null or e.owner_id = actor or e.owner_id = my_pro)
 order by e.owner_id is not null, e.name
 limit 500;
end $fn$;

-- Cria ou edita. Admin: exercícios oficiais. Profissional aprovado: os próprios. Ninguém edita o slug.
create function wellness_private.save_exercise(p_id uuid, p_name text, p_aliases text[], p_muscles text, p_instructions text,
 p_phase_cues jsonb, p_video text, p_level text, p_equipment text)
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); is_admin boolean; is_pro boolean; cur public.exercise_library; result uuid;
 v_name text := btrim(regexp_replace(coalesce(p_name,''), '\s+', ' ', 'g'));
 v_aliases text[] := (select coalesce(array_agg(distinct lower(btrim(a))), '{}') from unnest(coalesce(p_aliases,'{}')) a where char_length(btrim(a)) between 2 and 80);
begin
 select p.role = 'admin', p.role = 'profissional' and p.approved into is_admin, is_pro from public.profiles p where p.id = actor;
 if not coalesce(is_admin,false) and not coalesce(is_pro,false) then raise exception using errcode = '42501', message = 'Biblioteca disponível para profissionais aprovados e admin.'; end if;
 if char_length(v_name) not between 3 and 80 or cardinality(v_aliases) > 15 or char_length(coalesce(p_muscles,'')) > 300
  or char_length(coalesce(p_instructions,'')) > 1500 or not wellness_private.valid_phase_cues(p_phase_cues)
  or (p_video is not null and p_video !~ '^[A-Za-z0-9_-]{11}$') or (p_level is not null and p_level not in ('iniciante','intermediario','avancado'))
  or char_length(coalesce(p_equipment,'')) > 80 then
  raise exception using errcode = '22023', message = 'Dados do exercício inválidos.'; end if;
 if p_id is null then
  insert into public.exercise_library (owner_id, name, aliases, muscles, instructions, phase_cues, video, level, equipment, updated_by)
   values (case when is_admin then null else actor end, v_name, v_aliases, nullif(btrim(coalesce(p_muscles,'')),''), nullif(btrim(coalesce(p_instructions,'')),''),
    p_phase_cues, p_video, p_level, nullif(btrim(coalesce(p_equipment,'')),''), actor)
   returning id into result;
  return result;
 end if;
 select * into cur from public.exercise_library where id = p_id for update;
 if not found or cur.status <> 'ativo' or (cur.owner_id is null and not is_admin) or (cur.owner_id is not null and cur.owner_id <> actor) then
  raise exception using errcode = '42501', message = 'Exercício indisponível.'; end if;
 update public.exercise_library set name = v_name, aliases = v_aliases, muscles = nullif(btrim(coalesce(p_muscles,'')),''),
  instructions = nullif(btrim(coalesce(p_instructions,'')),''), phase_cues = p_phase_cues, video = p_video, level = p_level,
  equipment = nullif(btrim(coalesce(p_equipment,'')),''), updated_at = now(), updated_by = actor
  where id = p_id;
 return p_id;
end $fn$;

create function wellness_private.archive_exercise(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); is_admin boolean;
begin
 select p.role = 'admin' into is_admin from public.profiles p where p.id = actor;
 update public.exercise_library set status = 'arquivado', updated_at = now(), updated_by = actor
  where id = p_id and status = 'ativo' and slug is null and ((owner_id is null and coalesce(is_admin,false)) or owner_id = actor);
 if not found then raise exception using errcode = '42501', message = 'Exercício indisponível (os 30 animados não podem ser arquivados).'; end if;
end $fn$;

create function public.list_exercises()
 returns table (exercise_id uuid, slug text, owner_id uuid, owner_name text, name text, aliases text[], muscles text, instructions text,
  phase_cues jsonb, video text, level text, equipment text, official boolean, mine boolean, updated_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_exercises()$$;
create function public.save_exercise(p_id uuid, p_name text, p_aliases text[], p_muscles text, p_instructions text, p_phase_cues jsonb, p_video text, p_level text, p_equipment text)
 returns uuid language sql security invoker set search_path = '' as $$select wellness_private.save_exercise(p_id, p_name, p_aliases, p_muscles, p_instructions, p_phase_cues, p_video, p_level, p_equipment)$$;
create function public.archive_exercise(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.archive_exercise(p_id)$$;

revoke all on function wellness_private.list_exercises(), public.list_exercises(),
 wellness_private.save_exercise(uuid,text,text[],text,text,jsonb,text,text,text), public.save_exercise(uuid,text,text[],text,text,jsonb,text,text,text),
 wellness_private.archive_exercise(uuid), public.archive_exercise(uuid) from public, anon, authenticated;
grant execute on function wellness_private.list_exercises(), public.list_exercises(),
 wellness_private.save_exercise(uuid,text,text[],text,text,jsonb,text,text,text), public.save_exercise(uuid,text,text[],text,text,jsonb,text,text,text),
 wellness_private.archive_exercise(uuid), public.archive_exercise(uuid) to authenticated;
