-- Feed de vídeos dos profissionais na home do aluno, ordenado por proximidade.
-- * O profissional aprovado publica um link do YouTube; o vídeo só entra no feed depois da
--   aprovação de um administrador. O admin também pode retirar um vídeo já aprovado.
-- * Proximidade: região salva (UF, cidade, bairro) de cada conta e, opcionalmente, uma
--   coordenada aproximada (2 casas decimais, cerca de 1 km). Nunca endereço exato.
-- * A localização GPS do aluno no feed é enviada só na consulta e não é gravada.

create table public.account_locations (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 uf text not null check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 city text not null check (char_length(city) between 2 and 80),
 neighborhood text check (neighborhood is null or char_length(neighborhood) between 2 and 80),
 lat numeric(5,2) check (lat between -34 and 6),
 lng numeric(5,2) check (lng between -74 and -28),
 updated_at timestamptz not null default now(),
 check ((lat is null) = (lng is null))
);
alter table public.account_locations enable row level security;
revoke all on public.account_locations from public, anon, authenticated;
grant select on public.account_locations to authenticated;
grant select, insert, update, delete on public.account_locations to service_role;
create policy account_locations_read_self on public.account_locations for select to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.account_locations is 'Região da própria conta (UF, cidade, bairro e coordenada aproximada). Lida só pelo titular; outras contas veem apenas cidade/bairro do profissional no feed.';

create table public.feed_videos (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null references public.profiles(id) on delete cascade,
 youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 title text not null check (char_length(title) between 3 and 120),
 description text check (description is null or char_length(description) between 1 and 1000),
 status text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
 review_reason text check (review_reason is null or char_length(review_reason) between 1 and 1000),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 approved_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index feed_videos_one_live_per_link on public.feed_videos(professional_id, youtube_id) where status in ('pending','approved');
create index feed_videos_review_queue on public.feed_videos(created_at, id) where status = 'pending';
create index feed_videos_published on public.feed_videos(approved_at desc) where status = 'approved';
create index feed_videos_owner on public.feed_videos(professional_id, created_at desc);
alter table public.feed_videos enable row level security;
revoke all on public.feed_videos from public, anon, authenticated;
grant select on public.feed_videos to authenticated;
grant select, insert, update, delete on public.feed_videos to service_role;
create policy feed_videos_owner_or_admin on public.feed_videos for select to authenticated
 using (coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false'
  and (professional_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')));
comment on table public.feed_videos is 'Vídeos (YouTube) enviados por profissionais aprovados. Alunos leem só os aprovados, pela função student_video_feed.';

-- Chave de comparação de nomes de lugar: sem acento, minúsculas, espaços normalizados.
create function wellness_private.place_key(p text) returns text
 language sql immutable set search_path = '' as $fn$
 select lower(translate(btrim(regexp_replace(coalesce(p,''), '\s+', ' ', 'g')),
  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
$fn$;
revoke all on function wellness_private.place_key(text) from public, anon, authenticated;

-- Extrai o identificador de 11 caracteres de um link do YouTube. Retorna null se não for um link aceito.
create function wellness_private.youtube_video_id(p_url text) returns text
 language sql immutable set search_path = '' as $fn$
 select case when p_url is null or char_length(p_url) > 300 then null else
  (regexp_match(btrim(p_url), '^https://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:[^#]*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$'))[1] end
$fn$;
revoke all on function wellness_private.youtube_video_id(text) from public, anon, authenticated;

create function wellness_private.require_member() returns uuid
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := auth.uid();
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
  or not exists (select 1 from public.profiles p where p.id = actor) then
  raise exception using errcode = '42501', message = 'Acesso indisponível.';
 end if;
 return actor;
end $fn$;
revoke all on function wellness_private.require_member() from public, anon, authenticated;

-- Grava a região da própria conta. Coordenadas são arredondadas para cerca de 1 km.
create function wellness_private.set_my_location(p_uf text, p_city text, p_neighborhood text, p_lat numeric, p_lng numeric)
 returns public.account_locations language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.account_locations;
 v_city text := btrim(regexp_replace(coalesce(p_city,''), '\s+', ' ', 'g'));
 v_hood text := nullif(btrim(regexp_replace(coalesce(p_neighborhood,''), '\s+', ' ', 'g')), '');
begin
 if p_uf is null or upper(btrim(p_uf)) not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
  or char_length(v_city) not between 2 and 80 or (v_hood is not null and char_length(v_hood) not between 2 and 80)
  or (p_lat is null) <> (p_lng is null) or (p_lat is not null and (p_lat not between -34 and 6 or p_lng not between -74 and -28)) then
  raise exception using errcode = '22023', message = 'Região inválida.';
 end if;
 insert into public.account_locations (user_id, uf, city, neighborhood, lat, lng)
  values (actor, upper(btrim(p_uf)), v_city, v_hood, round(p_lat, 2), round(p_lng, 2))
 on conflict (user_id) do update set uf = excluded.uf, city = excluded.city, neighborhood = excluded.neighborhood,
  lat = excluded.lat, lng = excluded.lng, updated_at = now()
 returning * into result;
 return result;
end $fn$;

-- Profissional aprovado envia um vídeo; fica pendente até a análise do admin.
create function wellness_private.submit_feed_video(p_url text, p_title text, p_description text)
 returns public.feed_videos language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.feed_videos;
 v_id text := wellness_private.youtube_video_id(p_url);
 v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_desc text := nullif(btrim(coalesce(p_description,'')), '');
begin
 perform p.id from public.profiles p where p.id = actor for update;
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'profissional' and p.approved) then
  raise exception using errcode = '42501', message = 'Envio disponível só para profissionais aprovados.';
 end if;
 if v_id is null then raise exception using errcode = '22023', message = 'Use um link do YouTube.'; end if;
 if char_length(v_title) not between 3 and 120 or (v_desc is not null and char_length(v_desc) > 1000) then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 if (select count(*) from public.feed_videos v where v.professional_id = actor and v.status = 'pending') >= 10 then
  raise exception using errcode = '54000', message = 'Aguarde a análise dos vídeos enviados.';
 end if;
 if exists (select 1 from public.feed_videos v where v.professional_id = actor and v.youtube_id = v_id and v.status in ('pending','approved')) then
  raise exception using errcode = '23505', message = 'Este vídeo já foi enviado.';
 end if;
 insert into public.feed_videos (professional_id, youtube_id, title, description)
  values (actor, v_id, v_title, v_desc) returning * into result;
 return result;
end $fn$;

-- O próprio profissional retira um vídeo pendente ou publicado.
create function wellness_private.remove_feed_video(p_video_id uuid)
 returns public.feed_videos language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.feed_videos;
begin
 update public.feed_videos set status = 'removed'
  where id = p_video_id and professional_id = actor and status in ('pending','approved')
  returning * into result;
 if not found then raise exception using errcode = '42501', message = 'Vídeo indisponível.'; end if;
 return result;
end $fn$;

-- Admin: aprova ou recusa um pendente; ou retira um já aprovado. Sempre com motivo.
create function wellness_private.review_feed_video(p_video_id uuid, p_decision text, p_reason text)
 returns public.feed_videos language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.feed_videos;
 v_reason text := btrim(coalesce(p_reason,''));
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then
  raise exception using errcode = '42501', message = 'Análise indisponível.';
 end if;
 if p_decision is null or p_decision not in ('approved','rejected','removed') or char_length(v_reason) not between 1 and 1000 then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 select * into result from public.feed_videos where id = p_video_id for update;
 if not found or (p_decision in ('approved','rejected') and result.status <> 'pending')
  or (p_decision = 'removed' and result.status <> 'approved') then
  raise exception using errcode = '42501', message = 'Atualize a lista antes de analisar.';
 end if;
 update public.feed_videos set status = p_decision, review_reason = v_reason, reviewed_by = actor, reviewed_at = now(),
  approved_at = case when p_decision = 'approved' then now() else approved_at end
  where id = p_video_id returning * into result;
 return result;
end $fn$;

-- Admin: fila de análise (pendentes primeiro) ou publicados, com o nome do profissional.
create function wellness_private.list_feed_videos_for_review(p_status text, p_page integer)
 returns table (video_id uuid, youtube_id text, title text, description text, status text, professional_id uuid,
  professional_name text, review_reason text, created_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then
  raise exception using errcode = '42501', message = 'Análise indisponível.';
 end if;
 if p_status is null or p_status not in ('pending','approved') or p_page is null or p_page not between 1 and 10000 then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 return query select v.id, v.youtube_id, v.title, v.description, v.status, v.professional_id, p.display_name, v.review_reason, v.created_at
  from public.feed_videos v join public.profiles p on p.id = v.professional_id
  where v.status = p_status
  order by case when p_status = 'pending' then v.created_at end asc, v.approved_at desc nulls last, v.id
  limit 20 offset (p_page - 1) * 20;
end $fn$;

-- Feed do aluno: vídeos aprovados de profissionais ainda aprovados, do mais próximo ao mais distante.
-- Com p_lat/p_lng (GPS da sessão, não gravado) ou coordenada salva, usa distância aproximada em km;
-- sem coordenadas, usa mesmo bairro > mesma cidade > mesmo estado > demais. Mais recentes primeiro em empate.
create function wellness_private.student_video_feed(p_lat numeric, p_lng numeric, p_page integer)
 returns table (video_id uuid, youtube_id text, title text, description text, professional_id uuid,
  professional_name text, specialty text, uf text, city text, neighborhood text, proximity text,
  distance_km integer, published_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); me public.account_locations;
 o_lat numeric; o_lng numeric;
begin
 if p_page is null or p_page not between 1 and 500 or (p_lat is null) <> (p_lng is null)
  or (p_lat is not null and (p_lat not between -34 and 6 or p_lng not between -74 and -28)) then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 select * into me from public.account_locations where user_id = actor;
 o_lat := coalesce(round(p_lat, 2), me.lat); o_lng := coalesce(round(p_lng, 2), me.lng);
 return query
 with rows as (
  select v.id, v.youtube_id, v.title, v.description, v.professional_id, p.display_name,
   (select a.specialty from public.professional_applications a where a.applicant_id = p.id and a.status = 'approved') as specialty,
   l.uf, l.city, l.neighborhood, v.approved_at,
   case
    when me.user_id is null or l.user_id is null then 'outras'
    when l.uf = me.uf and wellness_private.place_key(l.city) = wellness_private.place_key(me.city)
     and me.neighborhood is not null and l.neighborhood is not null
     and wellness_private.place_key(l.neighborhood) = wellness_private.place_key(me.neighborhood) then 'bairro'
    when l.uf = me.uf and wellness_private.place_key(l.city) = wellness_private.place_key(me.city) then 'cidade'
    when l.uf = me.uf then 'estado'
    else 'outras' end as proximity,
   case when o_lat is null or l.lat is null then null else
    greatest(1, round(12742 * asin(least(1, sqrt(
     power(sin(radians((l.lat - o_lat) / 2)), 2)
     + cos(radians(o_lat)) * cos(radians(l.lat)) * power(sin(radians((l.lng - o_lng) / 2)), 2)))))::integer) end as distance_km
  from public.feed_videos v
  join public.profiles p on p.id = v.professional_id and p.role = 'profissional' and p.approved
  left join public.account_locations l on l.user_id = v.professional_id
  where v.status = 'approved'
 )
 select r.id, r.youtube_id, r.title, r.description, r.professional_id, r.display_name, r.specialty,
  r.uf, r.city, r.neighborhood, r.proximity, r.distance_km, r.approved_at
 from rows r
 order by coalesce(r.distance_km, case r.proximity when 'bairro' then 3 when 'cidade' then 15 when 'estado' then 300 else 5000 end),
  r.approved_at desc, r.id
 limit 12 offset (p_page - 1) * 12;
end $fn$;

-- Funções públicas (chamadas pelo app) delegam às privadas.
create function public.set_my_location(p_uf text, p_city text, p_neighborhood text, p_lat numeric, p_lng numeric)
 returns setof public.account_locations language sql security invoker set search_path = ''
 as $$select * from wellness_private.set_my_location(p_uf, p_city, p_neighborhood, p_lat, p_lng)$$;
create function public.submit_feed_video(p_url text, p_title text, p_description text)
 returns setof public.feed_videos language sql security invoker set search_path = ''
 as $$select * from wellness_private.submit_feed_video(p_url, p_title, p_description)$$;
create function public.remove_feed_video(p_video_id uuid)
 returns setof public.feed_videos language sql security invoker set search_path = ''
 as $$select * from wellness_private.remove_feed_video(p_video_id)$$;
create function public.review_feed_video(p_video_id uuid, p_decision text, p_reason text)
 returns setof public.feed_videos language sql security invoker set search_path = ''
 as $$select * from wellness_private.review_feed_video(p_video_id, p_decision, p_reason)$$;
create function public.list_feed_videos_for_review(p_status text, p_page integer)
 returns table (video_id uuid, youtube_id text, title text, description text, status text, professional_id uuid,
  professional_name text, review_reason text, created_at timestamptz)
 language sql stable security invoker set search_path = ''
 as $$select * from wellness_private.list_feed_videos_for_review(p_status, p_page)$$;
create function public.student_video_feed(p_lat numeric, p_lng numeric, p_page integer)
 returns table (video_id uuid, youtube_id text, title text, description text, professional_id uuid,
  professional_name text, specialty text, uf text, city text, neighborhood text, proximity text,
  distance_km integer, published_at timestamptz)
 language sql stable security invoker set search_path = ''
 as $$select * from wellness_private.student_video_feed(p_lat, p_lng, p_page)$$;

revoke all on function
 wellness_private.set_my_location(text,text,text,numeric,numeric), public.set_my_location(text,text,text,numeric,numeric),
 wellness_private.submit_feed_video(text,text,text), public.submit_feed_video(text,text,text),
 wellness_private.remove_feed_video(uuid), public.remove_feed_video(uuid),
 wellness_private.review_feed_video(uuid,text,text), public.review_feed_video(uuid,text,text),
 wellness_private.list_feed_videos_for_review(text,integer), public.list_feed_videos_for_review(text,integer),
 wellness_private.student_video_feed(numeric,numeric,integer), public.student_video_feed(numeric,numeric,integer)
 from public, anon, authenticated;
grant execute on function
 wellness_private.set_my_location(text,text,text,numeric,numeric), public.set_my_location(text,text,text,numeric,numeric),
 wellness_private.submit_feed_video(text,text,text), public.submit_feed_video(text,text,text),
 wellness_private.remove_feed_video(uuid), public.remove_feed_video(uuid),
 wellness_private.review_feed_video(uuid,text,text), public.review_feed_video(uuid,text,text),
 wellness_private.list_feed_videos_for_review(text,integer), public.list_feed_videos_for_review(text,integer),
 wellness_private.student_video_feed(numeric,numeric,integer), public.student_video_feed(numeric,numeric,integer)
 to authenticated;
