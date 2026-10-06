create table public.training_plans (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 student_id uuid not null references public.profiles(id),
 professional_id uuid not null references public.profiles(id),
 link_version bigint not null check(link_version>0),
 title text not null check(char_length(btrim(title)) between 1 and 120),
 content text not null check(char_length(btrim(content)) between 1 and 6000),
 created_at timestamptz not null default now(),
 check(student_id<>professional_id),
 unique(professional_id,request_id),
 unique(id,student_id)
);
create index training_plans_student_page_idx on public.training_plans(student_id,created_at desc,id);
create index training_plans_professional_page_idx on public.training_plans(professional_id,created_at desc,id);
create table public.training_plan_notifications (
 plan_id uuid primary key,
 recipient_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 foreign key(plan_id,recipient_id) references public.training_plans(id,student_id) on delete cascade
);
create index training_notifications_recipient_idx on public.training_plan_notifications(recipient_id,created_at desc,plan_id);
alter table public.training_plans enable row level security;
alter table public.training_plan_notifications enable row level security;
revoke all on public.training_plans,public.training_plan_notifications from public,anon,authenticated;
grant select on public.training_plans,public.training_plan_notifications to authenticated;
grant select,insert,update,delete on public.training_plans,public.training_plan_notifications to service_role;
create function wellness_private.can_access_training_plan(p_student_id uuid,p_professional_id uuid,p_link_version bigint)
 returns boolean language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false')='false'
  and exists(select 1 from public.profiles student join public.profiles professional on professional.id=p_professional_id
   join public.professional_applications app on app.applicant_id=professional.id
   join public.student_professional_links link on link.student_id=student.id
   where student.id=p_student_id and student.role='aluno' and professional.role='profissional' and professional.approved
    and app.status='approved' and app.specialty='educacao_fisica'
    and link.professional_id=professional.id and link.state='active' and link.version=p_link_version
    and ((auth.uid()=student.id and student.role='aluno') or auth.uid()=professional.id))
$fn$;
revoke all on function wellness_private.can_access_training_plan(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function wellness_private.can_access_training_plan(uuid,uuid,bigint) to authenticated;
create policy training_plans_current_participants on public.training_plans for select to authenticated
 using(wellness_private.can_access_training_plan(student_id,professional_id,link_version));
create policy training_notifications_owned on public.training_plan_notifications for select to authenticated
 using(recipient_id=(select auth.uid()) and exists(select 1 from public.training_plans p where p.id=plan_id));
create function wellness_private.create_training_plan(p_student_id uuid,p_expected_link_version bigint,p_request_id uuid,p_title text,p_content text)
 returns public.training_plans language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); result public.training_plans;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_student_id is null or actor=p_student_id then raise exception using errcode='42501',message='Treino indisponível.';end if;
 if p_request_id is null or p_expected_link_version is null or p_expected_link_version<1 or p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_content is null or char_length(btrim(p_content)) not between 1 and 6000 then raise exception using errcode='22023',message='Dados inválidos.';end if;
 perform p.id from public.profiles p where p.id in(actor,p_student_id) order by p.id for update;
 perform l.student_id from public.student_professional_links l where l.student_id=p_student_id for update;
 if not wellness_private.can_access_training_plan(p_student_id,actor,p_expected_link_version) then raise exception using errcode='42501',message='Treino indisponível.';end if;
 select * into result from public.training_plans where professional_id=actor and request_id=p_request_id for update;
 if found then
  if result.student_id=p_student_id and result.link_version=p_expected_link_version and result.title=btrim(p_title) and result.content=btrim(p_content) then return result;end if;
  raise exception using errcode='23505',message='Solicitação já utilizada para outro treino.';
 end if;
 insert into public.training_plans(request_id,student_id,professional_id,link_version,title,content) values(p_request_id,p_student_id,actor,p_expected_link_version,btrim(p_title),btrim(p_content)) returning * into result;
 insert into public.training_plan_notifications(plan_id,recipient_id) values(result.id,p_student_id);
 return result;
end $fn$;
create function wellness_private.read_training_notification(p_plan_id uuid)
 returns public.training_plan_notifications language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); plan public.training_plans; result public.training_plan_notifications;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_plan_id is null then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 select * into plan from public.training_plans where id=p_plan_id;
 if not found or plan.student_id<>actor then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 perform p.id from public.profiles p where p.id in(plan.student_id,plan.professional_id) order by p.id for update;
 if not wellness_private.can_access_training_plan(plan.student_id,plan.professional_id,plan.link_version) then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 update public.training_plan_notifications set read_at=coalesce(read_at,now()) where plan_id=p_plan_id and recipient_id=actor returning * into result;
 if not found then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 return result;
end $fn$;
create function public.create_training_plan(p_student_id uuid,p_expected_link_version bigint,p_request_id uuid,p_title text,p_content text) returns setof public.training_plans language sql security invoker set search_path='' as $$select * from wellness_private.create_training_plan(p_student_id,p_expected_link_version,p_request_id,p_title,p_content)$$;
create function public.read_training_notification(p_plan_id uuid) returns setof public.training_plan_notifications language sql security invoker set search_path='' as $$select * from wellness_private.read_training_notification(p_plan_id)$$;
revoke all on function wellness_private.create_training_plan(uuid,bigint,uuid,text,text),wellness_private.read_training_notification(uuid),public.create_training_plan(uuid,bigint,uuid,text,text),public.read_training_notification(uuid) from public,anon,authenticated;
grant execute on function wellness_private.create_training_plan(uuid,bigint,uuid,text,text),wellness_private.read_training_notification(uuid),public.create_training_plan(uuid,bigint,uuid,text,text),public.read_training_notification(uuid) to authenticated;
comment on table public.training_plans is 'Immutable client publications of human-authored workout text. Requires approved education_fisica application and exact active link version. No AI, diagnosis, exercise execution, or clinical consent workflow included.';
