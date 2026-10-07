-- Availability only: one-hour blocks, no appointment, payment or ranking event.
create table public.professional_availability_days (
 professional_id uuid not null references public.profiles(id) on delete restrict,
 day date not null,
 available_hours smallint[] not null default '{}',
 released boolean not null default false,
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 updated_at timestamptz not null default now(),
 primary key(professional_id,day),
 check(cardinality(available_hours)<=19 and available_hours <@ array[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]::smallint[]),
 check(not released or cardinality(available_hours)>0)
);
alter table public.professional_availability_days enable row level security;
revoke all on public.professional_availability_days from public,anon,authenticated,service_role;
grant select on public.professional_availability_days to authenticated,service_role;
create policy own_professional_availability on public.professional_availability_days for select to authenticated using (
 professional_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='profissional' and p.approved)
);
create function wellness_private.save_professional_availability(p_day date,p_expected_version bigint,p_hours smallint[],p_released boolean)
returns setof public.professional_availability_days language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid();current_row public.professional_availability_days;hours smallint[];today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Professional required';end if;
 perform 1 from public.profiles where id=actor and role='profissional' and approved for update;
 if not found then raise insufficient_privilege using message='Approved professional required';end if;
 if p_day is null or p_day<today or p_day>today+366 or p_expected_version is null or p_expected_version<0 or p_expected_version>=9007199254740991 or p_hours is null or p_released is null or cardinality(p_hours)>19
 or array_ndims(p_hours)>1 or array_position(p_hours,null) is not null or not p_hours <@ array[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]::smallint[] then raise invalid_parameter_value using message='Invalid availability';end if;
 select coalesce(array_agg(distinct h order by h),'{}'::smallint[]) into hours from unnest(p_hours) h;
 if cardinality(hours)<>cardinality(p_hours) or p_released and cardinality(hours)=0 then raise invalid_parameter_value using message='Invalid hours';end if;
 select * into current_row from public.professional_availability_days where professional_id=actor and day=p_day for update;
 if found then
  if current_row.version<>p_expected_version then raise serialization_failure using message='Availability changed; refresh';end if;
  update public.professional_availability_days set available_hours=hours,released=p_released,version=version+1,updated_at=clock_timestamp() where professional_id=actor and day=p_day returning * into current_row;
 else
  if p_expected_version<>0 then raise serialization_failure using message='Availability changed; refresh';end if;
  insert into public.professional_availability_days(professional_id,day,available_hours,released) values(actor,p_day,hours,p_released) returning * into current_row;
 end if;
 return next current_row;
end $fn$;
create function public.save_professional_availability(p_day date,p_expected_version bigint,p_hours smallint[],p_released boolean)
returns setof public.professional_availability_days language sql security invoker set search_path='' as $fn$
 select * from wellness_private.save_professional_availability(p_day,p_expected_version,p_hours,p_released);
$fn$;
create function wellness_private.list_released_availability(p_professional_id uuid,p_month date)
returns table(professional_id uuid,day date,available_hours smallint[]) language plpgsql stable security definer set search_path='' as $fn$
declare month_start date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='aluno') then raise insufficient_privilege using message='Student required';end if;
 if p_professional_id is null or p_month is null or extract(day from p_month)<>1 or p_month<month_start or p_month>(month_start+interval '12 months')::date then raise invalid_parameter_value using message='Invalid month';end if;
 return query select a.professional_id,a.day,eligible.hours from public.professional_availability_days a
 join public.profiles p on p.id=a.professional_id and p.role='profissional' and p.approved and btrim(p.display_name)<>''
 cross join lateral (select array_agg(h order by h)::smallint[] as hours from unnest(a.available_hours) h where a.day>(now() at time zone 'America/Sao_Paulo')::date or h>extract(hour from now() at time zone 'America/Sao_Paulo')) eligible
 where a.professional_id=p_professional_id and a.released and eligible.hours is not null and a.day>=p_month and a.day<(p_month+interval '1 month')::date
 and a.day>=(now() at time zone 'America/Sao_Paulo')::date order by a.day;
end $fn$;
create function public.list_released_availability(p_professional_id uuid,p_month date)
returns table(professional_id uuid,day date,available_hours smallint[]) language sql stable security invoker set search_path='' as $fn$
 select * from wellness_private.list_released_availability(p_professional_id,p_month);
$fn$;
revoke all on function wellness_private.save_professional_availability(date,bigint,smallint[],boolean),public.save_professional_availability(date,bigint,smallint[],boolean),wellness_private.list_released_availability(uuid,date),public.list_released_availability(uuid,date) from public,anon,authenticated,service_role;
grant execute on function wellness_private.save_professional_availability(date,bigint,smallint[],boolean),public.save_professional_availability(date,bigint,smallint[],boolean),wellness_private.list_released_availability(uuid,date),public.list_released_availability(uuid,date) to authenticated;
