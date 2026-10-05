create schema if not exists wellness_private;
revoke all on schema wellness_private from public, anon;
grant usage on schema wellness_private to authenticated;

create table public.student_professional_links (
 student_id uuid primary key references public.profiles(id) on delete cascade,
 professional_id uuid not null references public.profiles(id) on delete cascade,
 state text not null check (state in ('pending','active','revoked')),
 version bigint not null default 1 check (version > 0),
 requested_at timestamptz not null default now(),
 accepted_at timestamptz,
 revoked_at timestamptz,
 check (student_id <> professional_id),
 check ((state='pending' and accepted_at is null and revoked_at is null)
     or (state='active' and accepted_at is not null and revoked_at is null)
     or (state='revoked' and revoked_at is not null))
);
create index student_links_professional_idx on public.student_professional_links(professional_id);
alter table public.student_professional_links enable row level security;
revoke all on public.student_professional_links from public, anon, authenticated;
grant select on public.student_professional_links to authenticated;
grant select,insert,update,delete on public.student_professional_links to service_role;
create policy student_links_participants on public.student_professional_links for select to authenticated
 using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and
   ((student_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='aluno'))
    or (professional_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='profissional' and p.approved))));

-- Definer cores are outside the exposed API schema, with a fixed search_path,
-- authenticated actor checks and no caller-supplied acting user ID.
create function wellness_private.request_student_link(p_professional_id uuid)
 returns public.student_professional_links language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); existing public.student_professional_links; result public.student_professional_links;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_professional_id is null then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 -- All operations lock profile rows in the same order before the link row.
 perform id from public.profiles where id in (actor,p_professional_id) order by id for update;
 if not exists(select 1 from public.profiles where id=actor and role='aluno')
   or not exists(select 1 from public.profiles where id=p_professional_id and role='profissional' and approved) then
   raise exception using errcode='42501',message='Vínculo indisponível.';
 end if;
 select * into existing from public.student_professional_links where student_id=actor for update;
 if found and existing.state in ('pending','active') then
   if existing.professional_id=p_professional_id then return existing; end if;
   raise exception using errcode='23505',message='Encerre o vínculo atual antes de escolher outro profissional.';
 end if;
 insert into public.student_professional_links(student_id,professional_id,state)
 values(actor,p_professional_id,'pending')
 on conflict(student_id) do update set professional_id=excluded.professional_id,state='pending',version=public.student_professional_links.version+1,requested_at=now(),accepted_at=null,revoked_at=null
 returning * into result;
 return result;
end $fn$;

create function wellness_private.accept_student_link(p_student_id uuid,p_expected_version bigint)
 returns public.student_professional_links language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.student_professional_links;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_student_id is null or p_expected_version is null or p_expected_version<1 then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 perform id from public.profiles where id in (actor,p_student_id) order by id for update;
 if not exists(select 1 from public.profiles where id=actor and role='profissional' and approved)
   or not exists(select 1 from public.profiles where id=p_student_id and role='aluno') then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 select * into result from public.student_professional_links where student_id=p_student_id for update;
 if not found or result.professional_id<>actor or result.version<>p_expected_version or result.state='revoked' then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 if result.state='active' then return result; end if;
 update public.student_professional_links set state='active',accepted_at=now() where student_id=p_student_id returning * into result;
 return result;
end $fn$;

create function wellness_private.revoke_student_link(p_student_id uuid,p_expected_version bigint)
 returns public.student_professional_links language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); provider uuid; result public.student_professional_links;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_student_id is null or p_expected_version is null or p_expected_version<1 then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 select professional_id into provider from public.student_professional_links where student_id=p_student_id;
 if provider is null or actor not in (p_student_id,provider) then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 perform id from public.profiles where id in (p_student_id,provider) order by id for update;
 if not exists(select 1 from public.profiles where id=actor and ((actor=p_student_id and role='aluno') or (actor=provider and role='profissional'))) then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 select * into result from public.student_professional_links where student_id=p_student_id for update;
 -- Recheck participant after locking: a revoked request may have been replaced.
 if not found or actor not in (result.student_id,result.professional_id) or result.version<>p_expected_version then raise exception using errcode='42501',message='Vínculo indisponível.'; end if;
 if result.state='revoked' then return result; end if;
 update public.student_professional_links set state='revoked',revoked_at=now() where student_id=p_student_id returning * into result;
 return result;
end $fn$;

create function public.request_student_link(p_professional_id uuid) returns setof public.student_professional_links
 language sql security invoker set search_path='' as $$select * from wellness_private.request_student_link(p_professional_id)$$;
create function public.accept_student_link(p_student_id uuid,p_expected_version bigint) returns setof public.student_professional_links
 language sql security invoker set search_path='' as $$select * from wellness_private.accept_student_link(p_student_id,p_expected_version)$$;
create function public.revoke_student_link(p_student_id uuid,p_expected_version bigint) returns setof public.student_professional_links
 language sql security invoker set search_path='' as $$select * from wellness_private.revoke_student_link(p_student_id,p_expected_version)$$;
revoke all on function wellness_private.request_student_link(uuid),wellness_private.accept_student_link(uuid,bigint),wellness_private.revoke_student_link(uuid,bigint) from public,anon,authenticated;
grant execute on function wellness_private.request_student_link(uuid),wellness_private.accept_student_link(uuid,bigint),wellness_private.revoke_student_link(uuid,bigint) to authenticated;
revoke all on function public.request_student_link(uuid),public.accept_student_link(uuid,bigint),public.revoke_student_link(uuid,bigint) from public,anon,authenticated;
grant execute on function public.request_student_link(uuid),public.accept_student_link(uuid,bigint),public.revoke_student_link(uuid,bigint) to authenticated;
comment on table public.student_professional_links is 'One current relationship per student. Student requests; approved professional accepts the exact version. Participants may revoke. No direct client writes; no clinical data.';
