-- Ajustes do fluxo do feed de vídeos:
-- 1) Links do YouTube aceitos em mais formatos (sem "https://", com "http://", maiúsculas no endereço,
--    music.youtube.com). O identificador do vídeo continua obrigatório e validado.
-- 2) O administrador também publica vídeos, como "Equipe 369 WELLNESS". Como ele é quem aprova,
--    o vídeo dele já nasce publicado (com o registro de quem publicou).
-- 3) O feed passa a incluir os vídeos da equipe (sem região: aparecem depois dos profissionais próximos).

create or replace function wellness_private.youtube_video_id(p_url text) returns text
 language sql immutable set search_path = '' as $fn$
 select case when p_url is null or char_length(p_url) > 300 then null else
  (regexp_match(btrim(p_url), '^(?:https?://)?(?:www\.|m\.|music\.)?(?:youtube\.com/(?:watch\?(?:[^#]*&)?v=|shorts/|embed/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$', 'i'))[1] end
$fn$;

create or replace function wellness_private.submit_feed_video(p_url text, p_title text, p_description text)
 returns public.feed_videos language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.feed_videos; is_admin boolean;
 v_id text := wellness_private.youtube_video_id(p_url);
 v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_desc text := nullif(btrim(coalesce(p_description,'')), '');
begin
 perform p.id from public.profiles p where p.id = actor for update;
 select p.role = 'admin' into is_admin from public.profiles p where p.id = actor;
 if not coalesce(is_admin, false) and not exists (select 1 from public.profiles p where p.id = actor and p.role = 'profissional' and p.approved) then
  raise exception using errcode = '42501', message = 'Envio disponível só para profissionais aprovados.';
 end if;
 if v_id is null then raise exception using errcode = '22023', message = 'Use um link do YouTube.'; end if;
 if char_length(v_title) not between 3 and 120 or (v_desc is not null and char_length(v_desc) > 1000) then
  raise exception using errcode = '22023', message = 'Dados inválidos.';
 end if;
 if not is_admin and (select count(*) from public.feed_videos v where v.professional_id = actor and v.status = 'pending') >= 10 then
  raise exception using errcode = '54000', message = 'Aguarde a análise dos vídeos enviados.';
 end if;
 if exists (select 1 from public.feed_videos v where v.professional_id = actor and v.youtube_id = v_id and v.status in ('pending','approved')) then
  raise exception using errcode = '23505', message = 'Este vídeo já foi enviado.';
 end if;
 if is_admin then
  insert into public.feed_videos (professional_id, youtube_id, title, description, status, review_reason, reviewed_by, reviewed_at, approved_at)
   values (actor, v_id, v_title, v_desc, 'approved', 'Publicado pela equipe.', actor, now(), now()) returning * into result;
 else
  insert into public.feed_videos (professional_id, youtube_id, title, description)
   values (actor, v_id, v_title, v_desc) returning * into result;
 end if;
 return result;
end $fn$;

create or replace function wellness_private.student_video_feed(p_lat numeric, p_lng numeric, p_page integer)
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
  select v.id, v.youtube_id, v.title, v.description, v.professional_id,
   case when p.role = 'admin' then 'Equipe 369 WELLNESS' else p.display_name end as display_name,
   case when p.role = 'admin' then null else
    (select a.specialty from public.professional_applications a where a.applicant_id = p.id and a.status = 'approved') end as specialty,
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
  join public.profiles p on p.id = v.professional_id and (p.role = 'profissional' and p.approved or p.role = 'admin')
  left join public.account_locations l on l.user_id = v.professional_id and p.role = 'profissional'
  where v.status = 'approved'
 )
 select r.id, r.youtube_id, r.title, r.description, r.professional_id, r.display_name, r.specialty,
  r.uf, r.city, r.neighborhood, r.proximity, r.distance_km, r.approved_at
 from rows r
 order by coalesce(r.distance_km, case r.proximity when 'bairro' then 3 when 'cidade' then 15 when 'estado' then 300 else 5000 end),
  r.approved_at desc, r.id
 limit 12 offset (p_page - 1) * 12;
end $fn$;
