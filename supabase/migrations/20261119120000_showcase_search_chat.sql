-- Fase 2 do focus group: vitrine do profissional, busca por modalidade e região, e chat.
-- * Vitrine: o profissional aprovado descreve apresentação, formação, experiência, modalidades e se
--   atende presencial e/ou online. Qualquer conta logada vê a vitrine de profissionais aprovados.
-- * Busca: por modalidade e por "perto de mim" (região salva ou GPS da sessão, não gravado) ou "online".
-- * Chat (só por funções, sem acesso direto às tabelas):
--   - aluno <-> profissional: só entre aluno e o profissional do vínculo (pedido ou ativo);
--   - suporte: qualquer aluno ou profissional <-> equipe (todos os admins veem a mesma conversa).
--   O admin NÃO lê conversas entre aluno e profissional (privacidade).

create function wellness_private.modality_keys() returns text[]
 language sql immutable set search_path = '' as $fn$
 select array['educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais','yoga','pilates','danca','corrida','funcional','massoterapia','meditacao']
$fn$;
revoke all on function wellness_private.modality_keys() from public, anon, authenticated;

create table public.professional_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 headline text not null check (char_length(headline) between 3 and 120),
 bio text check (bio is null or char_length(bio) between 1 and 1500),
 education text check (education is null or char_length(education) between 1 and 1000),
 experience text check (experience is null or char_length(experience) between 1 and 1000),
 modalities text[] not null check (cardinality(modalities) between 1 and 6 and modalities <@ array['educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais','yoga','pilates','danca','corrida','funcional','massoterapia','meditacao']),
 modes text[] not null check (cardinality(modes) between 1 and 2 and modes <@ array['presencial','online']),
 updated_at timestamptz not null default now()
);
alter table public.professional_profiles enable row level security;
revoke all on public.professional_profiles from public, anon, authenticated;
grant select on public.professional_profiles to authenticated;
grant select, insert, update, delete on public.professional_profiles to service_role;
create policy professional_profiles_read_self on public.professional_profiles for select to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.professional_profiles is 'Vitrine do profissional. O titular lê/edita pela função save_my_showcase; outras contas veem só profissionais aprovados, pelas funções de busca e vitrine.';

create function wellness_private.save_my_showcase(p_headline text, p_bio text, p_education text, p_experience text, p_modalities text[], p_modes text[])
 returns public.professional_profiles language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.professional_profiles;
 v_head text := btrim(regexp_replace(coalesce(p_headline,''), '\s+', ' ', 'g'));
 v_mods text[] := (select array_agg(distinct m order by m) from unnest(coalesce(p_modalities,'{}')) m);
 v_modes text[] := (select array_agg(distinct m order by m) from unnest(coalesce(p_modes,'{}')) m);
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'profissional' and p.approved) then
  raise exception using errcode = '42501', message = 'Vitrine disponível só para profissionais aprovados.';
 end if;
 if char_length(v_head) not between 3 and 120
  or coalesce(cardinality(v_mods),0) not between 1 and 6 or not v_mods <@ wellness_private.modality_keys()
  or coalesce(cardinality(v_modes),0) not between 1 and 2 or not v_modes <@ array['presencial','online']
  or char_length(coalesce(p_bio,'')) > 1500 or char_length(coalesce(p_education,'')) > 1000 or char_length(coalesce(p_experience,'')) > 1000 then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 insert into public.professional_profiles (user_id, headline, bio, education, experience, modalities, modes)
  values (actor, v_head, nullif(btrim(coalesce(p_bio,'')),''), nullif(btrim(coalesce(p_education,'')),''), nullif(btrim(coalesce(p_experience,'')),''), v_mods, v_modes)
 on conflict (user_id) do update set headline = excluded.headline, bio = excluded.bio, education = excluded.education,
  experience = excluded.experience, modalities = excluded.modalities, modes = excluded.modes, updated_at = now()
 returning * into result;
 return result;
end $fn$;

-- Busca de profissionais aprovados. Sem vitrine preenchida, usa a área do cadastro profissional e "presencial".
create function wellness_private.search_professionals(p_modality text, p_mode text, p_lat numeric, p_lng numeric, p_page integer)
 returns table (professional_id uuid, display_name text, headline text, modalities text[], modes text[], uf text, city text,
  neighborhood text, proximity text, distance_km integer, video_count integer, link_state text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); me public.account_locations; o_lat numeric; o_lng numeric;
begin
 if p_page is null or p_page not between 1 and 500 or (p_modality is not null and not p_modality = any(wellness_private.modality_keys()))
  or (p_mode is not null and p_mode not in ('presencial','online')) or (p_lat is null) <> (p_lng is null)
  or (p_lat is not null and (p_lat not between -34 and 6 or p_lng not between -74 and -28)) then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 select * into me from public.account_locations where user_id = actor;
 o_lat := coalesce(round(p_lat, 2), me.lat); o_lng := coalesce(round(p_lng, 2), me.lng);
 return query
 with pros as (
  select p.id, p.display_name, pp.headline,
   coalesce(pp.modalities, case when a.specialty is null then '{}'::text[] else array[a.specialty] end) as mods,
   coalesce(pp.modes, array['presencial']) as mds, l.uf, l.city, l.neighborhood, l.lat, l.lng, l.user_id as loc
  from public.profiles p
  left join public.professional_profiles pp on pp.user_id = p.id
  left join public.professional_applications a on a.applicant_id = p.id and a.status = 'approved'
  left join public.account_locations l on l.user_id = p.id
  where p.role = 'profissional' and p.approved and btrim(p.display_name) <> '' and p.id <> actor
 ), ranked as (
  select r.*,
   case when me.user_id is null or r.loc is null then 'outras'
    when r.uf = me.uf and wellness_private.place_key(r.city) = wellness_private.place_key(me.city) and me.neighborhood is not null and r.neighborhood is not null
     and wellness_private.place_key(r.neighborhood) = wellness_private.place_key(me.neighborhood) then 'bairro'
    when r.uf = me.uf and wellness_private.place_key(r.city) = wellness_private.place_key(me.city) then 'cidade'
    when r.uf = me.uf then 'estado' else 'outras' end as prox,
   case when o_lat is null or r.lat is null then null else greatest(1, round(12742 * asin(least(1, sqrt(
    power(sin(radians((r.lat - o_lat) / 2)), 2) + cos(radians(o_lat)) * cos(radians(r.lat)) * power(sin(radians((r.lng - o_lng) / 2)), 2)))))::integer) end as dist
  from pros r
  where (p_modality is null or p_modality = any(r.mods)) and (p_mode is null or p_mode = any(r.mds))
 )
 select r.id, r.display_name, r.headline, r.mods, r.mds, r.uf, r.city, r.neighborhood, r.prox, r.dist,
  (select count(*)::integer from public.feed_videos v where v.professional_id = r.id and v.status = 'approved'),
  (select k.state from public.student_professional_links k where k.student_id = actor and k.professional_id = r.id and k.state in ('pending','active'))
 from ranked r
 order by case when p_mode = 'online' then 0 else coalesce(r.dist, case r.prox when 'bairro' then 3 when 'cidade' then 15 when 'estado' then 300 else 5000 end) end,
  (r.headline is null), r.display_name, r.id
 limit 12 offset (p_page - 1) * 12;
end $fn$;

-- Vitrine completa de um profissional aprovado, com os vídeos aprovados mais recentes.
create function wellness_private.professional_showcase(p_professional_id uuid)
 returns table (professional_id uuid, display_name text, headline text, bio text, education text, experience text,
  modalities text[], modes text[], uf text, city text, neighborhood text, credential_area text, videos jsonb, link_state text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query
 select p.id, p.display_name, pp.headline, pp.bio, pp.education, pp.experience,
  coalesce(pp.modalities, case when a.specialty is null then '{}'::text[] else array[a.specialty] end), coalesce(pp.modes, array['presencial']),
  l.uf, l.city, l.neighborhood, a.specialty,
  coalesce((select jsonb_agg(jsonb_build_object('youtube_id', v.youtube_id, 'title', v.title) order by v.approved_at desc)
   from (select * from public.feed_videos v where v.professional_id = p.id and v.status = 'approved' order by v.approved_at desc limit 6) v), '[]'::jsonb),
  (select k.state from public.student_professional_links k where k.student_id = actor and k.professional_id = p.id and k.state in ('pending','active'))
 from public.profiles p
 left join public.professional_profiles pp on pp.user_id = p.id
 left join public.professional_applications a on a.applicant_id = p.id and a.status = 'approved'
 left join public.account_locations l on l.user_id = p.id
 where p.id = p_professional_id and p.role = 'profissional' and p.approved;
end $fn$;

-- ===================== Chat =====================
create table public.chat_threads (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('vinculo','suporte')),
 member_id uuid not null references public.profiles(id) on delete cascade,
 professional_id uuid references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_message_at timestamptz,
 check ((kind = 'vinculo') = (professional_id is not null)),
 check (member_id is distinct from professional_id),
 unique nulls not distinct (kind, member_id, professional_id)
);
create index chat_threads_professional on public.chat_threads(professional_id) where professional_id is not null;
create index chat_threads_support on public.chat_threads(last_message_at desc) where kind = 'suporte';
create table public.chat_messages (
 id bigint generated always as identity primary key,
 thread_id uuid not null references public.chat_threads(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index chat_messages_thread on public.chat_messages(thread_id, id);
create index chat_messages_sender_recent on public.chat_messages(sender_id, created_at);
create table public.chat_reads (
 thread_id uuid not null references public.chat_threads(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 last_read_id bigint not null default 0,
 primary key (thread_id, user_id)
);
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
revoke all on public.chat_threads, public.chat_messages, public.chat_reads from public, anon, authenticated;
grant select, insert, update, delete on public.chat_threads, public.chat_messages, public.chat_reads to service_role;
comment on table public.chat_messages is 'Mensagens do chat. Acesso só pelas funções de chat: participantes do vínculo ou, no suporte, a pessoa e a equipe admin.';

-- Papel do usuário na conversa: 'membro', 'profissional', 'equipe' ou null (sem acesso).
create function wellness_private.chat_role(p_thread public.chat_threads, p_actor uuid) returns text
 language sql stable security definer set search_path = '' as $fn$
 select case
  when p_thread.member_id = p_actor then 'membro'
  when p_thread.kind = 'vinculo' and p_thread.professional_id = p_actor then 'profissional'
  when p_thread.kind = 'suporte' and exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin') then 'equipe'
  else null end
$fn$;
-- Pode escrever: no vínculo, só enquanto o pedido/vínculo existir e o profissional seguir aprovado.
create function wellness_private.chat_open(p_thread public.chat_threads) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select case when p_thread.kind = 'suporte' then true else exists (
  select 1 from public.student_professional_links k join public.profiles p on p.id = k.professional_id
  where k.student_id = p_thread.member_id and k.professional_id = p_thread.professional_id and k.state in ('pending','active')
   and p.role = 'profissional' and p.approved) end
$fn$;
revoke all on function wellness_private.chat_role(public.chat_threads, uuid), wellness_private.chat_open(public.chat_threads) from public, anon, authenticated;

-- Abre (ou reaproveita) uma conversa.
-- Sem p_with: conversa com a equipe (aluno ou profissional). Admin com p_with: conversa de suporte com essa pessoa.
-- Aluno com p_with = seu profissional; profissional aprovado com p_with = seu aluno.
create function wellness_private.open_chat(p_with uuid)
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); my_role text; v_member uuid; v_pro uuid; v_kind text; result uuid;
begin
 select p.role into my_role from public.profiles p where p.id = actor;
 if p_with is null then
  if my_role = 'admin' then raise exception using errcode = '22023', message = 'Escolha com quem conversar.'; end if;
  v_kind := 'suporte'; v_member := actor;
 elsif my_role = 'admin' then
  if not exists (select 1 from public.profiles p where p.id = p_with and p.role in ('aluno','profissional')) then
   raise exception using errcode = '42501', message = 'Conversa indisponível.'; end if;
  v_kind := 'suporte'; v_member := p_with;
 elsif my_role = 'aluno' then
  if not exists (select 1 from public.student_professional_links k where k.student_id = actor and k.professional_id = p_with and k.state in ('pending','active')) then
   raise exception using errcode = '42501', message = 'Converse com o profissional depois de enviar o pedido de acompanhamento.'; end if;
  v_kind := 'vinculo'; v_member := actor; v_pro := p_with;
 elsif my_role = 'profissional' and exists (select 1 from public.profiles p where p.id = actor and p.approved) then
  if not exists (select 1 from public.student_professional_links k where k.student_id = p_with and k.professional_id = actor and k.state in ('pending','active')) then
   raise exception using errcode = '42501', message = 'Conversa disponível só com seus alunos.'; end if;
  v_kind := 'vinculo'; v_member := p_with; v_pro := actor;
 else
  raise exception using errcode = '42501', message = 'Conversa indisponível.';
 end if;
 insert into public.chat_threads (kind, member_id, professional_id) values (v_kind, v_member, v_pro)
  on conflict (kind, member_id, professional_id) do nothing;
 select t.id into result from public.chat_threads t where t.kind = v_kind and t.member_id = v_member and t.professional_id is not distinct from v_pro;
 return result;
end $fn$;

create function wellness_private.list_chats()
 returns table (thread_id uuid, kind text, title text, last_body text, last_message_at timestamptz, unread integer, can_send boolean, counterpart_id uuid)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); is_admin boolean;
begin
 select p.role = 'admin' into is_admin from public.profiles p where p.id = actor;
 return query
 select t.id, t.kind,
  case when wellness_private.chat_role(t, actor) = 'equipe' then m.display_name
   when t.kind = 'suporte' then 'Equipe 369 WELLNESS'
   when t.member_id = actor then pr.display_name else m.display_name end,
  (select left(x.body, 80) from public.chat_messages x where x.thread_id = t.id order by x.id desc limit 1),
  t.last_message_at,
  (select count(*)::integer from public.chat_messages x where x.thread_id = t.id and x.sender_id <> actor
    and x.id > coalesce((select r.last_read_id from public.chat_reads r where r.thread_id = t.id and r.user_id = actor), 0)),
  wellness_private.chat_open(t),
  case when wellness_private.chat_role(t, actor) = 'equipe' then t.member_id when t.kind = 'suporte' then null
   when t.member_id = actor then t.professional_id else t.member_id end
 from public.chat_threads t
 join public.profiles m on m.id = t.member_id
 left join public.profiles pr on pr.id = t.professional_id
 where t.member_id = actor or (t.kind = 'vinculo' and t.professional_id = actor) or (t.kind = 'suporte' and is_admin)
 order by t.last_message_at desc nulls last, t.created_at desc
 limit 100;
end $fn$;

-- Mensagens de uma conversa (50 por vez) e marca como lidas.
create function wellness_private.read_chat(p_thread uuid, p_after bigint)
 returns table (message_id bigint, mine boolean, sender_label text, body text, created_at timestamptz)
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); t public.chat_threads; newest bigint;
begin
 select * into t from public.chat_threads where id = p_thread;
 if not found or wellness_private.chat_role(t, actor) is null then raise exception using errcode = '42501', message = 'Conversa indisponível.'; end if;
 select max(x.id) into newest from public.chat_messages x where x.thread_id = p_thread;
 if newest is not null then
  insert into public.chat_reads (thread_id, user_id, last_read_id) values (p_thread, actor, newest)
  on conflict on constraint chat_reads_pkey do update set last_read_id = greatest(public.chat_reads.last_read_id, excluded.last_read_id);
 end if;
 return query
 select q.id, q.sender_id = actor,
  case when q.sender_id = actor then 'Você' when s.role = 'admin' then 'Equipe 369 WELLNESS' else s.display_name end,
  q.body, q.created_at
 from (select * from public.chat_messages x where x.thread_id = p_thread and x.id > coalesce(p_after, 0) order by x.id desc limit 50) q
 join public.profiles s on s.id = q.sender_id
 order by q.id;
end $fn$;

create function wellness_private.send_chat_message(p_thread uuid, p_body text)
 returns bigint language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); t public.chat_threads; v_body text := btrim(coalesce(p_body,'')); result bigint;
begin
 select * into t from public.chat_threads where id = p_thread for update;
 if not found or wellness_private.chat_role(t, actor) is null then raise exception using errcode = '42501', message = 'Conversa indisponível.'; end if;
 if not wellness_private.chat_open(t) then raise exception using errcode = '42501', message = 'Esta conversa foi encerrada.'; end if;
 if char_length(v_body) not between 1 and 2000 then raise exception using errcode = '22023', message = 'Mensagem vazia ou longa demais.'; end if;
 if (select count(*) from public.chat_messages x where x.sender_id = actor and x.created_at > now() - interval '1 minute') >= 20 then
  raise exception using errcode = '54000', message = 'Muitas mensagens seguidas. Aguarde um minuto.'; end if;
 insert into public.chat_messages (thread_id, sender_id, body) values (p_thread, actor, v_body) returning id into result;
 update public.chat_threads set last_message_at = now() where id = p_thread;
 insert into public.chat_reads (thread_id, user_id, last_read_id) values (p_thread, actor, result)
  on conflict on constraint chat_reads_pkey do update set last_read_id = greatest(public.chat_reads.last_read_id, excluded.last_read_id);
 return result;
end $fn$;

create function wellness_private.chat_unread_total() returns integer
 language sql stable security definer set search_path = '' as $fn$
 select coalesce(sum(c.unread), 0)::integer from wellness_private.list_chats() c
$fn$;

-- Funções públicas (chamadas pelo app).
create function public.save_my_showcase(p_headline text, p_bio text, p_education text, p_experience text, p_modalities text[], p_modes text[])
 returns setof public.professional_profiles language sql security invoker set search_path = ''
 as $$select * from wellness_private.save_my_showcase(p_headline, p_bio, p_education, p_experience, p_modalities, p_modes)$$;
create function public.search_professionals(p_modality text, p_mode text, p_lat numeric, p_lng numeric, p_page integer)
 returns table (professional_id uuid, display_name text, headline text, modalities text[], modes text[], uf text, city text,
  neighborhood text, proximity text, distance_km integer, video_count integer, link_state text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.search_professionals(p_modality, p_mode, p_lat, p_lng, p_page)$$;
create function public.professional_showcase(p_professional_id uuid)
 returns table (professional_id uuid, display_name text, headline text, bio text, education text, experience text,
  modalities text[], modes text[], uf text, city text, neighborhood text, credential_area text, videos jsonb, link_state text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.professional_showcase(p_professional_id)$$;
create function public.open_chat(p_with uuid) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.open_chat(p_with)$$;
create function public.list_chats()
 returns table (thread_id uuid, kind text, title text, last_body text, last_message_at timestamptz, unread integer, can_send boolean, counterpart_id uuid)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_chats()$$;
create function public.read_chat(p_thread uuid, p_after bigint)
 returns table (message_id bigint, mine boolean, sender_label text, body text, created_at timestamptz)
 language sql security invoker set search_path = '' as $$select * from wellness_private.read_chat(p_thread, p_after)$$;
create function public.send_chat_message(p_thread uuid, p_body text) returns bigint
 language sql security invoker set search_path = '' as $$select wellness_private.send_chat_message(p_thread, p_body)$$;
create function public.chat_unread_total() returns integer
 language sql stable security invoker set search_path = '' as $$select wellness_private.chat_unread_total()$$;

revoke all on function
 wellness_private.save_my_showcase(text,text,text,text,text[],text[]), public.save_my_showcase(text,text,text,text,text[],text[]),
 wellness_private.search_professionals(text,text,numeric,numeric,integer), public.search_professionals(text,text,numeric,numeric,integer),
 wellness_private.professional_showcase(uuid), public.professional_showcase(uuid),
 wellness_private.open_chat(uuid), public.open_chat(uuid), wellness_private.list_chats(), public.list_chats(),
 wellness_private.read_chat(uuid,bigint), public.read_chat(uuid,bigint),
 wellness_private.send_chat_message(uuid,text), public.send_chat_message(uuid,text),
 wellness_private.chat_unread_total(), public.chat_unread_total()
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_my_showcase(text,text,text,text,text[],text[]), public.save_my_showcase(text,text,text,text,text[],text[]),
 wellness_private.search_professionals(text,text,numeric,numeric,integer), public.search_professionals(text,text,numeric,numeric,integer),
 wellness_private.professional_showcase(uuid), public.professional_showcase(uuid),
 wellness_private.open_chat(uuid), public.open_chat(uuid), wellness_private.list_chats(), public.list_chats(),
 wellness_private.read_chat(uuid,bigint), public.read_chat(uuid,bigint),
 wellness_private.send_chat_message(uuid,text), public.send_chat_message(uuid,text),
 wellness_private.chat_unread_total(), public.chat_unread_total()
 to authenticated;
