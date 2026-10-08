-- Project review is evidence preparation only; it does not release cashback.
create table public.esg_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 category text not null check(category in('economica','social','ambiental')),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 description text not null check(char_length(btrim(description)) between 1 and 6000),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 version bigint not null default 1 check(version in(1,2)),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 review_reason text,
 unique(owner_id,request_id),
 check((status='pending' and version=1 and reviewed_at is null and review_reason is null) or (status in('approved','rejected') and version=2 and reviewed_at is not null and reviewed_at>=submitted_at and char_length(btrim(review_reason)) between 1 and 1000 and review_reason is not null))
);
create index esg_projects_owner_date_idx on public.esg_projects(owner_id,submitted_at desc,id);
create index esg_projects_pending_idx on public.esg_projects(submitted_at,id) where status='pending';
create table public.esg_project_reviews (
 project_id uuid primary key references public.esg_projects(id) on delete restrict,
 reviewer_id uuid not null references public.profiles(id) on delete restrict,
 reviewed_version bigint not null check(reviewed_version=1),
 decision text not null check(decision in('approved','rejected')),
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index esg_reviews_reviewer_idx on public.esg_project_reviews(reviewer_id);
alter table public.esg_projects enable row level security;
alter table public.esg_project_reviews enable row level security;
revoke all on public.esg_projects,public.esg_project_reviews from public,anon,authenticated,service_role;
grant select on public.esg_projects,public.esg_project_reviews to authenticated,service_role;
create policy esg_projects_owner_or_admin on public.esg_projects for select to authenticated using(
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and
 (owner_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
);
create policy esg_reviews_owner_or_admin on public.esg_project_reviews for select to authenticated using(
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and exists(select 1 from public.esg_projects p where p.id=project_id)
);
create function wellness_private.submit_esg_project(p_request_id uuid,p_category text,p_title text,p_description text)
 returns public.esg_projects language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.esg_projects;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception using errcode='42501',message='Envio indisponível.';end if;
 perform p.id from public.profiles p where p.id=actor for update;
 if not exists(select 1 from public.profiles p where p.id=actor and p.role in('aluno','profissional')) then raise exception using errcode='42501',message='Envio indisponível.';end if;
 if p_request_id is null or p_category is null or p_category not in('economica','social','ambiental') or p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_description is null or char_length(btrim(p_description)) not between 1 and 6000 then raise exception using errcode='22023',message='Dados do projeto inválidos.';end if;
 select * into result from public.esg_projects where owner_id=actor and request_id=p_request_id;
 if found then
  if result.category=p_category and result.title=btrim(p_title) and result.description=btrim(p_description) then return result;end if;
  raise exception using errcode='23505',message='Identificador já usado para outro envio.';
 end if;
 insert into public.esg_projects(owner_id,request_id,category,title,description) values(actor,p_request_id,p_category,btrim(p_title),btrim(p_description)) returning * into result;
 return result;
end $fn$;
create function wellness_private.review_esg_project(p_project_id uuid,p_expected_version bigint,p_decision text,p_reason text)
 returns public.esg_projects language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.esg_projects; prior public.esg_project_reviews;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception using errcode='42501',message='Análise indisponível.';end if;
 perform p.id from public.profiles p where p.id=actor for update;
 if not exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then raise exception using errcode='42501',message='Análise indisponível.';end if;
 if p_project_id is null or p_expected_version is null or p_expected_version<>1 or p_decision is null or p_decision not in('approved','rejected') or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception using errcode='22023',message='Dados da análise inválidos.';end if;
 select * into result from public.esg_projects where id=p_project_id for update;
 if not found or result.owner_id=actor then raise exception using errcode='42501',message='Análise indisponível.';end if;
 if result.status<>'pending' then
  select * into prior from public.esg_project_reviews where project_id=result.id;
  if found and prior.reviewer_id=actor and prior.reviewed_version=p_expected_version and prior.decision=p_decision and prior.reason=btrim(p_reason) then return result;end if;
  raise exception using errcode='42501',message='Projeto já analisado. Atualize o histórico.';
 end if;
 insert into public.esg_project_reviews(project_id,reviewer_id,reviewed_version,decision,reason) values(result.id,actor,p_expected_version,p_decision,btrim(p_reason));
 update public.esg_projects set status=p_decision,version=2,reviewed_at=now(),review_reason=btrim(p_reason) where id=result.id returning * into result;
 return result;
end $fn$;
create function public.submit_esg_project(p_request_id uuid,p_category text,p_title text,p_description text) returns setof public.esg_projects language sql security invoker set search_path='' as $$select * from wellness_private.submit_esg_project(p_request_id,p_category,p_title,p_description)$$;
create function public.review_esg_project(p_project_id uuid,p_expected_version bigint,p_decision text,p_reason text) returns setof public.esg_projects language sql security invoker set search_path='' as $$select * from wellness_private.review_esg_project(p_project_id,p_expected_version,p_decision,p_reason)$$;
revoke all on function wellness_private.submit_esg_project(uuid,text,text,text),wellness_private.review_esg_project(uuid,bigint,text,text),public.submit_esg_project(uuid,text,text,text),public.review_esg_project(uuid,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function wellness_private.submit_esg_project(uuid,text,text,text),wellness_private.review_esg_project(uuid,bigint,text,text),public.submit_esg_project(uuid,text,text,text),public.review_esg_project(uuid,bigint,text,text) to authenticated;
