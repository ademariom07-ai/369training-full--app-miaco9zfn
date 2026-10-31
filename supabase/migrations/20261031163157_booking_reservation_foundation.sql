-- Individual one-hour reservation foundation only. No payment or confirmation endpoint.
create table public.booking_reservations (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 student_id uuid not null references public.profiles(id) on delete restrict,
 professional_id uuid not null references public.profiles(id) on delete restrict,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'pending_payment' check(status in ('pending_payment','cancelled','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check(student_id<>professional_id),
 check(ends_at=starts_at+interval '1 hour'),
 check(extract(hour from starts_at at time zone 'America/Sao_Paulo') between 5 and 23),
 check(date_trunc('hour',starts_at at time zone 'America/Sao_Paulo')=starts_at at time zone 'America/Sao_Paulo'),
 check(expires_at>created_at and expires_at<=starts_at),
 unique(student_id,request_id)
);
-- Expiration must be transitioned atomically by the future reservation service;
-- clock-dependent predicates are intentionally not used in unique indexes.
create unique index booking_reservations_professional_slot on public.booking_reservations(professional_id,starts_at) where status='pending_payment';
create unique index booking_reservations_student_slot on public.booking_reservations(student_id,starts_at) where status='pending_payment';
create index booking_reservations_student_history on public.booking_reservations(student_id,starts_at desc,id);
create index booking_reservations_professional_history on public.booking_reservations(professional_id,starts_at desc,id);
alter table public.booking_reservations enable row level security;
revoke all on public.booking_reservations from public,anon,authenticated,service_role;
grant select on public.booking_reservations to authenticated;
create policy booking_reservations_participant_read on public.booking_reservations for select to authenticated using (
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and ((student_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='aluno'))
 or (professional_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='profissional' and p.approved)))
);
comment on table public.booking_reservations is 'Foundation: read-only for participants. Creation, expiry, cancellation and verified payment integration not yet exposed. No confirmed state permitted.';
