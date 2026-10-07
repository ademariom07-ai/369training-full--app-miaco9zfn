-- Versioned quotes for future booking. No charge, booking or credit is created.
create table public.professional_booking_terms (
 id uuid primary key default gen_random_uuid(),
 professional_id uuid not null references public.profiles(id) on delete restrict,
 request_id uuid not null,
 version bigint not null check(version between 1 and 9007199254740991),
 price_cents bigint not null check(price_cents between 1 and 9007199254740991),
 deposit_basis_points integer not null check(deposit_basis_points between 1 and 10000),
 deposit_cents bigint generated always as (floor((price_cents::numeric*deposit_basis_points+5000)/10000)::bigint) stored,
 free_cancel_hours integer not null check(free_cancel_hours between 0 and 720),
 no_show_deposit_retained boolean not null default true check(no_show_deposit_retained),
 created_at timestamptz not null default now(),
 unique(professional_id,version),unique(professional_id,request_id),
 check(deposit_cents between 1 and price_cents)
);
alter table public.professional_booking_terms enable row level security;
revoke all on public.professional_booking_terms from public,anon,authenticated,service_role;
grant select on public.professional_booking_terms to authenticated,service_role;
create policy own_booking_terms on public.professional_booking_terms for select to authenticated using (
 professional_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='profissional' and p.approved)
);
create function wellness_private.save_professional_booking_terms(p_request_id uuid,p_expected_version bigint,p_price_cents bigint,p_deposit_basis_points integer,p_free_cancel_hours integer)
returns setof public.professional_booking_terms language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid();existing public.professional_booking_terms;latest bigint;deposit bigint;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Professional required';end if;
 perform 1 from public.profiles where id=actor and role='profissional' and approved for update;
 if not found then raise insufficient_privilege using message='Approved professional required';end if;
 if p_request_id is null or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740991
 or p_price_cents is null or p_price_cents not between 1 and 9007199254740991
 or p_deposit_basis_points is null or p_deposit_basis_points not between 1 and 10000
 or p_free_cancel_hours is null or p_free_cancel_hours not between 0 and 720 then raise invalid_parameter_value using message='Invalid booking terms';end if;
 deposit:=floor((p_price_cents::numeric*p_deposit_basis_points+5000)/10000)::bigint;
 if deposit<1 then raise invalid_parameter_value using message='Deposit must be at least one cent';end if;
 select * into existing from public.professional_booking_terms where professional_id=actor and request_id=p_request_id;
 if found then
  if existing.version<>p_expected_version+1 or existing.price_cents<>p_price_cents or existing.deposit_basis_points<>p_deposit_basis_points or existing.free_cancel_hours<>p_free_cancel_hours then raise unique_violation using message='Request already used';end if;
  return next existing;return;
 end if;
 select coalesce(max(version),0) into latest from public.professional_booking_terms where professional_id=actor;
 if latest<>p_expected_version then raise serialization_failure using message='Terms changed; refresh';end if;
 insert into public.professional_booking_terms(professional_id,request_id,version,price_cents,deposit_basis_points,free_cancel_hours)
 values(actor,p_request_id,latest+1,p_price_cents,p_deposit_basis_points,p_free_cancel_hours) returning * into existing;
 return next existing;
end $fn$;
create function public.save_professional_booking_terms(p_request_id uuid,p_expected_version bigint,p_price_cents bigint,p_deposit_basis_points integer,p_free_cancel_hours integer)
returns setof public.professional_booking_terms language sql security invoker set search_path='' as $fn$
 select * from wellness_private.save_professional_booking_terms(p_request_id,p_expected_version,p_price_cents,p_deposit_basis_points,p_free_cancel_hours);
$fn$;
create function wellness_private.get_professional_booking_terms(p_professional_id uuid)
returns table(id uuid,professional_id uuid,version bigint,price_cents bigint,deposit_basis_points integer,deposit_cents bigint,free_cancel_hours integer,no_show_deposit_retained boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
 or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='aluno') then raise insufficient_privilege using message='Student required';end if;
 if p_professional_id is null then raise invalid_parameter_value using message='Professional required';end if;
 return query select t.id,t.professional_id,t.version,t.price_cents,t.deposit_basis_points,t.deposit_cents,t.free_cancel_hours,t.no_show_deposit_retained,t.created_at
 from public.professional_booking_terms t join public.profiles p on p.id=t.professional_id and p.role='profissional' and p.approved and btrim(p.display_name)<>''
 where t.professional_id=p_professional_id order by t.version desc limit 1;
end $fn$;
create function public.get_professional_booking_terms(p_professional_id uuid)
returns table(id uuid,professional_id uuid,version bigint,price_cents bigint,deposit_basis_points integer,deposit_cents bigint,free_cancel_hours integer,no_show_deposit_retained boolean,created_at timestamptz)
language sql stable security invoker set search_path='' as $fn$
 select * from wellness_private.get_professional_booking_terms(p_professional_id);
$fn$;
revoke all on function wellness_private.save_professional_booking_terms(uuid,bigint,bigint,integer,integer),public.save_professional_booking_terms(uuid,bigint,bigint,integer,integer),wellness_private.get_professional_booking_terms(uuid),public.get_professional_booking_terms(uuid) from public,anon,authenticated,service_role;
grant execute on function wellness_private.save_professional_booking_terms(uuid,bigint,bigint,integer,integer),public.save_professional_booking_terms(uuid,bigint,bigint,integer,integer),wellness_private.get_professional_booking_terms(uuid),public.get_professional_booking_terms(uuid) to authenticated;
