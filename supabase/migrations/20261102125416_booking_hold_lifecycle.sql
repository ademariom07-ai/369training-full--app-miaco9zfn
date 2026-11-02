-- A hold is neither a payment nor a confirmed appointment. An operator must
-- explicitly set the hold duration before the first live request can succeed.
create table wellness_private.booking_hold_policy (
 singleton boolean primary key default true check(singleton),
 hold_minutes integer not null check(hold_minutes between 1 and 1440)
);
revoke all on wellness_private.booking_hold_policy from public,anon,authenticated,service_role;
alter table public.booking_reservations
 add column terms_id uuid references public.professional_booking_terms(id) on delete restrict,
 add column availability_version bigint check(availability_version>0),
 add column ended_at timestamptz;
create index booking_holds_due on public.booking_reservations(expires_at,id) where status='pending_payment';

create function wellness_private.create_booking_hold(p_request uuid,p_professional uuid,p_day date,p_hour integer,p_availability bigint,p_terms uuid)
returns public.booking_reservations language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r public.booking_reservations; q record; ttl integer; stamp timestamptz; start_time timestamptz;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege; end if;
 if p_request is null or p_professional is null or p_day is null or p_hour is null or p_hour not between 5 and 23 or p_terms is null or p_availability is null or p_availability<1 then raise invalid_parameter_value; end if;
 -- Serialize requests from the same student, including idempotent retries.
 perform 1 from public.profiles where id=actor and role='aluno' for update;
 if not found then raise insufficient_privilege; end if;
 start_time:=(p_day::timestamp+make_interval(hours=>p_hour)) at time zone 'America/Sao_Paulo';
 select * into r from public.booking_reservations where student_id=actor and request_id=p_request for update;
 if found then
  if (r.professional_id,r.starts_at,r.terms_id,r.availability_version) is distinct from (p_professional,start_time,p_terms,p_availability) then raise invalid_parameter_value using message='Pedido reutilizado com dados diferentes'; end if;
  if r.status='pending_payment' and r.expires_at<=clock_timestamp() then
   update public.booking_reservations set status='expired',ended_at=clock_timestamp() where id=r.id returning * into r;
  end if;
  return r;
 end if;
 select hold_minutes into ttl from wellness_private.booking_hold_policy where singleton for share;
 if not found then raise object_not_in_prerequisite_state using message='Reservas ainda não habilitadas'; end if;
 -- Writers of terms and availability hold the same professional profile lock.
 perform 1 from public.profiles where id=p_professional and role='profissional' and approved for update;
 if not found then raise no_data_found using message='Horário indisponível'; end if;
 update public.booking_reservations set status='expired',ended_at=clock_timestamp()
 where starts_at=start_time and status='pending_payment' and expires_at<=clock_timestamp()
 and (professional_id=p_professional or student_id=actor);
 select * into strict q from wellness_private.quote_booking_slot(p_professional,p_day,p_hour);
 if q.availability_version<>p_availability or q.terms_id<>p_terms then raise serialization_failure using message='Condições alteradas; atualize a cotação'; end if;
 stamp:=clock_timestamp();
 if q.starts_at<=stamp then raise no_data_found using message='Horário indisponível'; end if;
 insert into public.booking_reservations(student_id,professional_id,request_id,starts_at,ends_at,created_at,expires_at,terms_id,availability_version)
 values(actor,p_professional,p_request,q.starts_at,q.ends_at,stamp,least(q.starts_at,stamp+make_interval(mins=>ttl)),q.terms_id,q.availability_version) returning * into r;
 return r;
end $$;

create function wellness_private.cancel_booking_hold(p_id uuid)
returns public.booking_reservations language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r public.booking_reservations; stamp timestamptz;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege; end if;
 select b.* into r from public.booking_reservations b join public.profiles p on p.id=actor
 where b.id=p_id and ((b.student_id=actor and p.role='aluno') or (b.professional_id=actor and p.role='profissional' and p.approved)) for update of b;
 if not found then raise no_data_found using message='Reserva indisponível'; end if;
 stamp:=clock_timestamp();
 if r.status='pending_payment' then
  update public.booking_reservations set status=case when expires_at<=stamp then 'expired' else 'cancelled' end,ended_at=stamp where id=r.id returning * into r;
 end if;
 return r;
end $$;

create function wellness_private.expire_booking_holds() returns integer language sql volatile security invoker set search_path='' as $$
 with due as (select id from public.booking_reservations where status='pending_payment' and expires_at<=statement_timestamp() order by expires_at,id limit 500 for update skip locked),
 changed as (update public.booking_reservations b set status='expired',ended_at=clock_timestamp() from due where b.id=due.id returning b.id)
 select count(*)::int from changed;
$$;
revoke all on function wellness_private.expire_booking_holds() from public,anon,authenticated,service_role;
create function public.create_booking_hold(p_request uuid,p_professional uuid,p_day date,p_hour integer,p_availability bigint,p_terms uuid)
returns public.booking_reservations language sql volatile security invoker set search_path='' as $$select wellness_private.create_booking_hold(p_request,p_professional,p_day,p_hour,p_availability,p_terms)$$;
create function public.cancel_booking_hold(p_id uuid)
returns public.booking_reservations language sql volatile security invoker set search_path='' as $$select wellness_private.cancel_booking_hold(p_id)$$;
revoke all on function public.create_booking_hold(uuid,uuid,date,integer,bigint,uuid),wellness_private.create_booking_hold(uuid,uuid,date,integer,bigint,uuid),public.cancel_booking_hold(uuid),wellness_private.cancel_booking_hold(uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_booking_hold(uuid,uuid,date,integer,bigint,uuid),wellness_private.create_booking_hold(uuid,uuid,date,integer,bigint,uuid),public.cancel_booking_hold(uuid),wellness_private.cancel_booking_hold(uuid) to authenticated;
comment on table public.booking_reservations is 'Individual holds only. Create/cancel via authenticated RPC; only a verified future payment flow may confirm a booking.';
create extension if not exists pg_cron;
select cron.schedule('wellness-expire-booking-holds','* * * * *','select wellness_private.expire_booking_holds()');
