-- Only the duration is exposed. No payment operation and no initial live policy.
create table wellness_private.booking_hold_policy_changes (
 id bigint generated always as identity primary key, actor uuid not null,
 previous_minutes integer not null, new_minutes integer not null, changed_at timestamptz not null default clock_timestamp()
);
revoke all on wellness_private.booking_hold_policy_changes from public,anon,authenticated,service_role;
create function wellness_private.booking_hold_minutes() returns integer language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or not exists (select 1 from public.profiles where id=auth.uid()) then raise insufficient_privilege; end if;
 return coalesce((select hold_minutes from wellness_private.booking_hold_policy where singleton),0);
end $$;
create function wellness_private.set_booking_hold_minutes(p_expected integer,p_minutes integer) returns integer language plpgsql security definer set search_path='' as $$
declare prev integer;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege; end if;
 perform 1 from public.profiles where id=auth.uid() and role='admin' for share;
 if not found then raise insufficient_privilege; end if;
 if p_minutes is null or p_minutes not between 0 and 1440 or p_expected is null or p_expected not between 0 and 1440 then raise invalid_parameter_value; end if;
 lock table wellness_private.booking_hold_policy in share row exclusive mode;
 select coalesce((select hold_minutes from wellness_private.booking_hold_policy where singleton),0) into prev;
 if prev<>p_expected then raise serialization_failure using message='Atualize a configuração';end if;
 if prev=p_minutes then return prev;end if;
 if p_minutes=0 then delete from wellness_private.booking_hold_policy where singleton=true;
 else insert into wellness_private.booking_hold_policy(singleton,hold_minutes) values(true,p_minutes) on conflict(singleton) do update set hold_minutes=excluded.hold_minutes; end if;
 insert into wellness_private.booking_hold_policy_changes(actor,previous_minutes,new_minutes) values(auth.uid(),prev,p_minutes);
 return p_minutes;
end $$;
create function public.booking_hold_minutes() returns integer language sql stable security invoker set search_path='' as $$select wellness_private.booking_hold_minutes()$$;
create function public.set_booking_hold_minutes(p_expected integer,p_minutes integer) returns integer language sql volatile security invoker set search_path='' as $$select wellness_private.set_booking_hold_minutes(p_expected,p_minutes)$$;
revoke all on function wellness_private.booking_hold_minutes(),public.booking_hold_minutes(),wellness_private.set_booking_hold_minutes(integer,integer),public.set_booking_hold_minutes(integer,integer) from public,anon,authenticated,service_role;
grant execute on function wellness_private.booking_hold_minutes(),public.booking_hold_minutes(),wellness_private.set_booking_hold_minutes(integer,integer),public.set_booking_hold_minutes(integer,integer) to authenticated;
