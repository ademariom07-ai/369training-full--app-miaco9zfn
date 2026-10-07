-- Read-only booking review. A quote neither holds a slot nor confirms payment.
create function wellness_private.quote_booking_slot(p_professional_id uuid,p_day date,p_hour integer)
returns table(professional_id uuid,day date,hour integer,availability_version bigint,terms_id uuid,terms_version bigint,starts_at timestamptz,ends_at timestamptz,price_cents bigint,deposit_basis_points integer,deposit_cents bigint,balance_cents bigint,free_cancel_hours integer,free_cancel_deadline timestamptz,no_show_deposit_retained boolean,quoted_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
declare today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
 or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='aluno') then raise insufficient_privilege using message='Student required';end if;
 if p_professional_id is null or p_day is null or p_day<today or p_day>today+366 or p_hour is null or p_hour not between 5 and 23 then raise invalid_parameter_value using message='Invalid slot';end if;
 return query select a.professional_id,a.day,p_hour,a.version,t.id,t.version,slot.starts_at,slot.starts_at+interval '1 hour',t.price_cents,t.deposit_basis_points,t.deposit_cents,t.price_cents-t.deposit_cents,t.free_cancel_hours,
 case when t.free_cancel_hours=0 then null::timestamptz else slot.starts_at-make_interval(hours=>t.free_cancel_hours) end,t.no_show_deposit_retained,now()
 from public.professional_availability_days a
 join public.profiles p on p.id=a.professional_id and p.role='profissional' and p.approved and btrim(p.display_name)<>''
 cross join lateral (select x.* from public.professional_booking_terms x where x.professional_id=a.professional_id order by x.version desc limit 1) t
 cross join lateral (select (a.day::timestamp+make_interval(hours=>p_hour)) at time zone 'America/Sao_Paulo' as starts_at) slot
 where a.professional_id=p_professional_id and a.day=p_day and a.released and p_hour=any(a.available_hours) and slot.starts_at>now();
 if not found then raise no_data_found using message='Slot or terms unavailable; refresh';end if;
end $fn$;
create function public.quote_booking_slot(p_professional_id uuid,p_day date,p_hour integer)
returns table(professional_id uuid,day date,hour integer,availability_version bigint,terms_id uuid,terms_version bigint,starts_at timestamptz,ends_at timestamptz,price_cents bigint,deposit_basis_points integer,deposit_cents bigint,balance_cents bigint,free_cancel_hours integer,free_cancel_deadline timestamptz,no_show_deposit_retained boolean,quoted_at timestamptz)
language sql stable security invoker set search_path='' as $fn$
 select * from wellness_private.quote_booking_slot(p_professional_id,p_day,p_hour);
$fn$;
revoke all on function wellness_private.quote_booking_slot(uuid,date,integer),public.quote_booking_slot(uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function wellness_private.quote_booking_slot(uuid,date,integer),public.quote_booking_slot(uuid,date,integer) to authenticated;
