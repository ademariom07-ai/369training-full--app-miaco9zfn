-- Administrative intake only: reported facts are NOT verified payment evidence.
create table public.service_event_intake (
 event_id uuid primary key,
 service_id uuid not null,
 revision integer not null check(revision>0),
 period date not null check(extract(day from period)=1),
 student_id uuid not null references public.profiles(id) on delete restrict,
 partner_id uuid not null references public.profiles(id) on delete restrict,
 state text not null check(state in ('scheduled','completed','cancelled')),
 reported_payment text not null check(reported_payment in ('pending','confirmed','disputed','refunded')),
 student_reviewed boolean not null,
 partner_reviewed boolean not null,
 verification text not null default 'unverified' check(verification='unverified'),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(service_id,revision), check(student_id<>partner_id)
);
create index service_event_intake_period on public.service_event_intake(period,service_id,revision desc);
create index service_event_intake_student on public.service_event_intake(student_id);
create index service_event_intake_partner on public.service_event_intake(partner_id);
create index service_event_intake_actor on public.service_event_intake(created_by);
alter table public.service_event_intake enable row level security;
revoke all on public.service_event_intake from public,anon,authenticated,service_role;
grant select on public.service_event_intake to authenticated;
create policy service_intake_admin_read on public.service_event_intake for select to authenticated using (
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
create function wellness_private.record_service_event_intake(p_event_id uuid,p_service_id uuid,p_revision integer,p_period date,p_student_id uuid,p_partner_id uuid,p_state text,p_reported_payment text,p_student_reviewed boolean,p_partner_reviewed boolean)
returns setof public.service_event_intake language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); existing public.service_event_intake; first_event public.service_event_intake;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Admin required';end if;
 perform 1 from public.profiles where id=actor and role='admin' for update;
 if not found then raise insufficient_privilege using message='Admin required';end if;
 if p_event_id is null or p_service_id is null or p_revision is null or p_revision<1 or p_period is null or not isfinite(p_period) or extract(day from p_period)<>1
 or p_student_id is null or p_partner_id is null or p_student_id=p_partner_id
 or p_state is null or p_state not in ('scheduled','completed','cancelled')
 or p_reported_payment is null or p_reported_payment not in ('pending','confirmed','disputed','refunded')
 or p_student_reviewed is null or p_partner_reviewed is null then raise invalid_parameter_value using message='Invalid intake';end if;
 -- Serialize all administrators recording the same service, including its first revision.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('369-service-intake:'||p_service_id::text,0));
 select * into existing from public.service_event_intake where event_id=p_event_id;
 if found then
  if row(existing.service_id,existing.revision,existing.period,existing.student_id,existing.partner_id,existing.state,existing.reported_payment,existing.student_reviewed,existing.partner_reviewed)
   is distinct from row(p_service_id,p_revision,p_period,p_student_id,p_partner_id,p_state,p_reported_payment,p_student_reviewed,p_partner_reviewed)
  then raise unique_violation using message='Event ID already used';end if;
  return next existing;return;
 end if;
 select * into first_event from public.service_event_intake where service_id=p_service_id order by revision limit 1;
 if found and row(first_event.period,first_event.student_id,first_event.partner_id) is distinct from row(p_period,p_student_id,p_partner_id)
 then raise invalid_parameter_value using message='Service identity requires reconciliation';end if;
 if not exists(select 1 from public.profiles where id=p_student_id and role='aluno')
 or not exists(select 1 from public.profiles where id=p_partner_id and role='profissional')
 then raise invalid_parameter_value using message='Invalid participants';end if;
 insert into public.service_event_intake(event_id,service_id,revision,period,student_id,partner_id,state,reported_payment,student_reviewed,partner_reviewed,created_by)
 values(p_event_id,p_service_id,p_revision,p_period,p_student_id,p_partner_id,p_state,p_reported_payment,p_student_reviewed,p_partner_reviewed,actor) returning * into existing;
 return next existing;
end $fn$;
create function public.record_service_event_intake(p_event_id uuid,p_service_id uuid,p_revision integer,p_period date,p_student_id uuid,p_partner_id uuid,p_state text,p_reported_payment text,p_student_reviewed boolean,p_partner_reviewed boolean)
returns setof public.service_event_intake language sql security invoker set search_path='' as $fn$
 select * from wellness_private.record_service_event_intake(p_event_id,p_service_id,p_revision,p_period,p_student_id,p_partner_id,p_state,p_reported_payment,p_student_reviewed,p_partner_reviewed);
$fn$;
revoke all on function wellness_private.record_service_event_intake(uuid,uuid,integer,date,uuid,uuid,text,text,boolean,boolean),public.record_service_event_intake(uuid,uuid,integer,date,uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function wellness_private.record_service_event_intake(uuid,uuid,integer,date,uuid,uuid,text,text,boolean,boolean),public.record_service_event_intake(uuid,uuid,integer,date,uuid,uuid,text,text,boolean,boolean) to authenticated;
comment on table public.service_event_intake is 'Immutable administrative intake, always unverified. No payment confirmation, tariff charge, points write, wallet credit or monthly closing. Do not feed reported_payment into verified ranking or settlement.';
