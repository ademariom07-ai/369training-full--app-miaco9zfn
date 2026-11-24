-- Avaliações depois do acompanhamento: aluno avalia o profissional e profissional avalia o aluno (nota 1 a 5 e comentário).
-- Quem pode avaliar: as duas pontas de um vínculo que chegou a ser aceito (ativo ou encerrado depois de ativo).
-- Uma nova avaliação da mesma pessoa a cada 30 dias.
-- Média: as 100 avaliações mais recentes (não ocultadas), descartando as 3 piores (com 3 ou menos avaliações, usa todas).
-- Quem vê: nota do profissional → todos (vitrine); nota do aluno → o próprio aluno, profissionais com vínculo com ele
-- (inclusive pedido pendente) e admin. O admin pode ocultar uma avaliação abusiva, com motivo.

create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 reviewer_id uuid not null references public.profiles(id) on delete cascade,
 reviewee_id uuid not null references public.profiles(id) on delete cascade,
 direction text not null check (direction in ('aluno_profissional','profissional_aluno')),
 rating smallint not null check (rating between 1 and 5),
 comment text check (comment is null or char_length(comment) between 1 and 500),
 created_at timestamptz not null default now(),
 hidden boolean not null default false,
 hidden_reason text check (hidden_reason is null or char_length(hidden_reason) between 3 and 300),
 check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee on public.reviews(reviewee_id, created_at desc);
create index reviews_pair on public.reviews(reviewer_id, reviewee_id, created_at desc);
alter table public.reviews enable row level security;
revoke all on public.reviews from public, anon, authenticated;
grant select, insert, update, delete on public.reviews to service_role;
comment on table public.reviews is 'Avaliações aluno ↔ profissional. Acesso só pelas funções *review*.';

-- Houve acompanhamento aceito entre aluno e profissional (ativo ou encerrado depois de aceito)?
create function wellness_private.had_link(p_student uuid, p_pro uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.student_professional_links k where k.student_id = p_student and k.professional_id = p_pro
  and (k.state = 'active' or (k.state = 'revoked' and k.accepted_at is not null)))
$fn$;
-- A pessoa pode ver as notas de p_user?
create function wellness_private.can_see_reviews(p_viewer uuid, p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select p_viewer = p_user
  or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'profissional')
  or exists (select 1 from public.profiles p where p.id = p_viewer and p.role = 'admin')
  or exists (select 1 from public.student_professional_links k where k.student_id = p_user and k.professional_id = p_viewer)
$fn$;
-- Média das 100 mais recentes sem as 3 piores.
create function wellness_private.review_stats(p_user uuid)
 returns table (average numeric, counted integer, total integer, dropped integer)
 language sql stable security definer set search_path = '' as $fn$
 with last as (select r.rating from public.reviews r where r.reviewee_id = p_user and not r.hidden order by r.created_at desc limit 100),
 ranked as (select l.rating, row_number() over (order by l.rating asc) as rn, count(*) over () as n from last l)
 select round(avg(rating) filter (where n <= 3 or rn > 3), 2), (count(*) filter (where n <= 3 or rn > 3))::int,
  (select count(*)::int from public.reviews r where r.reviewee_id = p_user and not r.hidden),
  (case when max(n) > 3 then 3 else 0 end)::int
 from ranked
$fn$;
revoke all on function wellness_private.had_link(uuid, uuid), wellness_private.can_see_reviews(uuid, uuid), wellness_private.review_stats(uuid) from public, anon, authenticated;

-- Envia uma avaliação. Retorna o id.
create function wellness_private.submit_review(p_reviewee uuid, p_rating integer, p_comment text) returns uuid
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); me text; them text; v_dir text; v_comment text := nullif(btrim(coalesce(p_comment,'')), ''); last_at timestamptz; result uuid;
begin
 select p.role into me from public.profiles p where p.id = actor;
 select case when p.role = 'profissional' and p.approved then 'profissional' else p.role end into them from public.profiles p where p.id = p_reviewee;
 if me = 'aluno' and them = 'profissional' and wellness_private.had_link(actor, p_reviewee) then v_dir := 'aluno_profissional';
 elsif me = 'profissional' and them = 'aluno' and wellness_private.had_link(p_reviewee, actor) then v_dir := 'profissional_aluno';
 else raise exception using errcode = '42501', message = 'Você só pode avaliar quem acompanhou você (ou seus alunos).'; end if;
 if coalesce(p_rating, 0) not between 1 and 5 or char_length(coalesce(v_comment,'')) > 500 then
  raise exception using errcode = '22023', message = 'Dê uma nota de 1 a 5 (comentário até 500 caracteres).'; end if;
 select max(r.created_at) into last_at from public.reviews r where r.reviewer_id = actor and r.reviewee_id = p_reviewee;
 if last_at is not null and last_at > now() - interval '30 days' then
  raise exception using errcode = '54000', message = 'Você já avaliou nos últimos 30 dias.'; end if;
 insert into public.reviews (reviewer_id, reviewee_id, direction, rating, comment) values (actor, p_reviewee, v_dir, p_rating, v_comment) returning id into result;
 return result;
end $fn$;

-- Resumo das notas de várias pessoas (vitrine, busca, pedidos de vínculo). Quem não pode ver fica de fora.
create function wellness_private.review_summaries(p_users uuid[])
 returns table (user_id uuid, average numeric, counted integer, total integer, dropped integer)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if coalesce(array_length(p_users, 1), 0) > 60 then raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 return query select u, s.average, s.counted, s.total, s.dropped
  from unnest(p_users) u cross join lateral wellness_private.review_stats(u) s
  where wellness_private.can_see_reviews(actor, u);
end $fn$;

-- Comentários recentes sobre uma pessoa (primeiro nome de quem avaliou).
create function wellness_private.list_reviews(p_user uuid, p_page integer)
 returns table (review_id uuid, reviewer_name text, rating smallint, comment text, created_at timestamptz, hidden boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); is_admin boolean;
begin
 if coalesce(p_page, 0) not between 1 and 20 then raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 if not wellness_private.can_see_reviews(actor, p_user) then raise exception using errcode = '42501', message = 'Avaliações indisponíveis.'; end if;
 select p.role = 'admin' into is_admin from public.profiles p where p.id = actor;
 return query select r.id, split_part(coalesce(p.display_name, 'Usuário'), ' ', 1), r.rating, r.comment, r.created_at, r.hidden
  from public.reviews r join public.profiles p on p.id = r.reviewer_id
  where r.reviewee_id = p_user and (not r.hidden or coalesce(is_admin, false))
  order by r.created_at desc limit 20 offset (p_page - 1) * 20;
end $fn$;

-- Posso avaliar esta pessoa agora? (e minha última nota)
create function wellness_private.my_review_status(p_reviewee uuid)
 returns table (can_review boolean, next_at timestamptz, last_rating smallint)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); me text; them text; eligible boolean; last public.reviews;
begin
 select p.role into me from public.profiles p where p.id = actor;
 select case when p.role = 'profissional' and p.approved then 'profissional' else p.role end into them from public.profiles p where p.id = p_reviewee;
 eligible := (me = 'aluno' and them = 'profissional' and wellness_private.had_link(actor, p_reviewee))
  or (me = 'profissional' and them = 'aluno' and wellness_private.had_link(p_reviewee, actor));
 select * into last from public.reviews r where r.reviewer_id = actor and r.reviewee_id = p_reviewee order by r.created_at desc limit 1;
 return query select coalesce(eligible, false) and (last.id is null or last.created_at <= now() - interval '30 days'),
  case when last.id is null then null else last.created_at + interval '30 days' end, last.rating;
end $fn$;

-- Admin oculta (ou mostra de novo) uma avaliação.
create function wellness_private.hide_review(p_id uuid, p_hide boolean, p_reason text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then raise exception using errcode = '42501', message = 'Acesso indisponível.'; end if;
 if p_hide and char_length(coalesce(v_reason,'')) not between 3 and 300 then raise exception using errcode = '22023', message = 'Informe o motivo.'; end if;
 update public.reviews set hidden = p_hide, hidden_reason = case when p_hide then v_reason end where id = p_id;
 if not found then raise exception using errcode = '42501', message = 'Avaliação indisponível.'; end if;
end $fn$;
-- Admin: avaliações recentes (todas), para moderação.
create function wellness_private.list_recent_reviews()
 returns table (review_id uuid, reviewer_name text, reviewee_name text, direction text, rating smallint, comment text, created_at timestamptz, hidden boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then raise exception using errcode = '42501', message = 'Acesso indisponível.'; end if;
 return query select r.id, a.display_name, b.display_name, r.direction, r.rating, r.comment, r.created_at, r.hidden
  from public.reviews r join public.profiles a on a.id = r.reviewer_id join public.profiles b on b.id = r.reviewee_id
  order by r.created_at desc limit 100;
end $fn$;

create function public.submit_review(p_reviewee uuid, p_rating integer, p_comment text) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.submit_review(p_reviewee, p_rating, p_comment)$$;
create function public.review_summaries(p_users uuid[]) returns table (user_id uuid, average numeric, counted integer, total integer, dropped integer)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.review_summaries(p_users)$$;
create function public.list_reviews(p_user uuid, p_page integer) returns table (review_id uuid, reviewer_name text, rating smallint, comment text, created_at timestamptz, hidden boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_reviews(p_user, p_page)$$;
create function public.my_review_status(p_reviewee uuid) returns table (can_review boolean, next_at timestamptz, last_rating smallint)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.my_review_status(p_reviewee)$$;
create function public.hide_review(p_id uuid, p_hide boolean, p_reason text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.hide_review(p_id, p_hide, p_reason)$$;
create function public.list_recent_reviews()
 returns table (review_id uuid, reviewer_name text, reviewee_name text, direction text, rating smallint, comment text, created_at timestamptz, hidden boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_recent_reviews()$$;

revoke all on function
 wellness_private.submit_review(uuid,integer,text), public.submit_review(uuid,integer,text),
 wellness_private.review_summaries(uuid[]), public.review_summaries(uuid[]), wellness_private.list_reviews(uuid,integer), public.list_reviews(uuid,integer),
 wellness_private.my_review_status(uuid), public.my_review_status(uuid), wellness_private.hide_review(uuid,boolean,text), public.hide_review(uuid,boolean,text),
 wellness_private.list_recent_reviews(), public.list_recent_reviews()
 from public, anon, authenticated;
grant execute on function
 wellness_private.submit_review(uuid,integer,text), public.submit_review(uuid,integer,text),
 wellness_private.review_summaries(uuid[]), public.review_summaries(uuid[]), wellness_private.list_reviews(uuid,integer), public.list_reviews(uuid,integer),
 wellness_private.my_review_status(uuid), public.my_review_status(uuid), wellness_private.hide_review(uuid,boolean,text), public.hide_review(uuid,boolean,text),
 wellness_private.list_recent_reviews(), public.list_recent_reviews()
 to authenticated;

notify pgrst, 'reload schema';
