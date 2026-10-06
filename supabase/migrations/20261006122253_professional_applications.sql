create table public.professional_applications (
 applicant_id uuid primary key references public.profiles(id) on delete cascade,
 applicant_name text not null check(char_length(btrim(applicant_name)) between 1 and 160),
 specialty text not null check(specialty in('educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais')),
 credential text not null check(char_length(btrim(credential)) between 1 and 160),
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 version bigint not null default 1 check(version>0),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 review_reason text,
 check((status='pending' and reviewed_at is null and review_reason is null) or (status in('approved','rejected') and reviewed_at is not null and review_reason is not null and char_length(btrim(review_reason)) between 1 and 1000))
);
create index professional_applications_queue_idx on public.professional_applications(requested_at,applicant_id) where status='pending';
create table public.professional_application_reviews (
 id uuid primary key default gen_random_uuid(),
 applicant_id uuid not null references public.professional_applications(applicant_id) on delete cascade,
 application_version bigint not null check(application_version>0),
 reviewer_id uuid not null references public.profiles(id),
 decision text not null check(decision in('approved','rejected')),
 reason text not null check(char_length(btrim(reason)) between 1 and 1000),
 specialty text not null,
 credential text not null,
 created_at timestamptz not null default now(),
 unique(applicant_id,application_version)
);
alter table public.professional_applications enable row level security;
alter table public.professional_application_reviews enable row level security;
revoke all on public.professional_applications,public.professional_application_reviews from public,anon,authenticated;
grant select on public.professional_applications,public.professional_application_reviews to authenticated;
grant select,insert,update,delete on public.professional_applications,public.professional_application_reviews to service_role;
create index professional_reviews_reviewer_idx on public.professional_application_reviews(reviewer_id);
create policy applications_owned_or_admin on public.professional_applications for select to authenticated
 using(coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (applicant_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')));
create policy application_reviews_owned_or_admin on public.professional_application_reviews for select to authenticated
 using(coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (applicant_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')));

create function wellness_private.submit_professional_application(p_specialty text,p_credential text)
 returns public.professional_applications language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.professional_applications;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception using errcode='42501',message='Solicitação indisponível.';end if;
 perform p.id from public.profiles p where p.id=actor for update;
 if not exists(select 1 from public.profiles p where p.id=actor and btrim(p.display_name)<>'' and (p.role='aluno' or p.role='profissional' and not p.approved)) then raise exception using errcode='42501',message='Solicitação indisponível.';end if;
 if p_specialty is null or p_specialty not in('educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais') or p_credential is null or char_length(btrim(p_credential)) not between 1 and 160 then raise exception using errcode='22023',message='Dados inválidos.';end if;
 select * into result from public.professional_applications where applicant_id=actor for update;
 if found and result.status='pending' then
  if result.specialty=p_specialty and result.credential=btrim(p_credential) then return result;end if;
  raise exception using errcode='23505',message='Aguarde a análise da solicitação atual.';
 end if;
 if found and result.status='approved' then raise exception using errcode='42501',message='Solicitação indisponível.';end if;
 insert into public.professional_applications(applicant_id,applicant_name,specialty,credential) select actor,btrim(p.display_name),p_specialty,btrim(p_credential) from public.profiles p where p.id=actor
 on conflict(applicant_id) do update set applicant_name=excluded.applicant_name,specialty=excluded.specialty,credential=excluded.credential,status='pending',version=public.professional_applications.version+1,requested_at=now(),reviewed_at=null,review_reason=null returning * into result;
 return result;
end $fn$;
create function wellness_private.review_professional_application(p_applicant_id uuid,p_expected_version bigint,p_decision text,p_reason text)
 returns public.professional_applications language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.professional_applications;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_applicant_id is null or actor=p_applicant_id then raise exception using errcode='42501',message='Análise indisponível.';end if;
 perform p.id from public.profiles p where p.id in(actor,p_applicant_id) order by p.id for update;
 if not exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then raise exception using errcode='42501',message='Análise indisponível.';end if;
 if p_expected_version is null or p_expected_version<1 or p_decision is null or p_decision not in('approved','rejected') or p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception using errcode='22023',message='Dados inválidos.';end if;
 select * into result from public.professional_applications where applicant_id=p_applicant_id for update;
 if not found or result.status<>'pending' or result.version<>p_expected_version then raise exception using errcode='42501',message='Atualize a solicitação antes de analisar.';end if;
 if not exists(select 1 from public.profiles p where p.id=p_applicant_id and (p.role='aluno' or p.role='profissional' and not p.approved)) then raise exception using errcode='42501',message='Análise indisponível.';end if;
 if p_decision='approved' then
  if exists(select 1 from public.student_professional_links l where l.student_id=p_applicant_id and l.state in('pending','active')) then raise exception using errcode='23505',message='Encerre o vínculo de aluno antes de aprovar o acesso profissional.';end if;
  update public.profiles set role='profissional',approved=true where id=p_applicant_id;
 end if;
 insert into public.professional_application_reviews(applicant_id,application_version,reviewer_id,decision,reason,specialty,credential) values(result.applicant_id,result.version,actor,p_decision,btrim(p_reason),result.specialty,result.credential);
 update public.professional_applications set status=p_decision,reviewed_at=now(),review_reason=btrim(p_reason) where applicant_id=p_applicant_id returning * into result;
 return result;
end $fn$;
create function public.submit_professional_application(p_specialty text,p_credential text) returns setof public.professional_applications language sql security invoker set search_path='' as $$select * from wellness_private.submit_professional_application(p_specialty,p_credential)$$;
create function public.review_professional_application(p_applicant_id uuid,p_expected_version bigint,p_decision text,p_reason text) returns setof public.professional_applications language sql security invoker set search_path='' as $$select * from wellness_private.review_professional_application(p_applicant_id,p_expected_version,p_decision,p_reason)$$;
revoke all on function wellness_private.submit_professional_application(text,text),wellness_private.review_professional_application(uuid,bigint,text,text),public.submit_professional_application(text,text),public.review_professional_application(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function wellness_private.submit_professional_application(text,text),wellness_private.review_professional_application(uuid,bigint,text,text),public.submit_professional_application(text,text),public.review_professional_application(uuid,bigint,text,text) to authenticated;
