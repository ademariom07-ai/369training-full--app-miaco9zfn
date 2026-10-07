-- Reservation foundation only: no credits, cashback closing, PIX or payment settlement.
create table public.wallet_accounts (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 available_cents bigint not null default 0 check(available_cents between 0 and 9007199254740991),
 reserved_cents bigint not null default 0 check(reserved_cents between 0 and 9007199254740991),
 version bigint not null default 1 check(version between 1 and 9007199254740991),
 updated_at timestamptz not null default now(),
 check(available_cents::numeric+reserved_cents<=9007199254740991)
);
create table public.wallet_withdrawals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.wallet_accounts(user_id) on delete restrict,
 request_id uuid not null,amount_cents bigint not null check(amount_cents between 1 and 9007199254740991),
 status text not null default 'reserved' check(status in('reserved','cancelled')),
 created_at timestamptz not null default now(),cancelled_at timestamptz,
 unique(user_id,request_id),unique(id,user_id),
 check((status='reserved' and cancelled_at is null) or (status='cancelled' and cancelled_at is not null))
);
create index wallet_withdrawals_owner_page on public.wallet_withdrawals(user_id,created_at desc,id);
create table public.wallet_reservation_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.wallet_accounts(user_id) on delete restrict,
 withdrawal_id uuid not null,kind text not null check(kind in('reserve','release')),
 amount_cents bigint not null check(amount_cents between 1 and 9007199254740991),
 account_version bigint not null check(account_version between 2 and 9007199254740991),
 available_before bigint not null check(available_before between 0 and 9007199254740991),
 available_after bigint not null check(available_after between 0 and 9007199254740991),
 reserved_before bigint not null check(reserved_before between 0 and 9007199254740991),
 reserved_after bigint not null check(reserved_after between 0 and 9007199254740991),
 created_at timestamptz not null default now(),
 foreign key(withdrawal_id,user_id) references public.wallet_withdrawals(id,user_id) on delete restrict,
 unique(withdrawal_id,kind),unique(user_id,account_version),
 check(available_before::numeric+reserved_before=available_after::numeric+reserved_after),
 check(available_before::numeric+reserved_before<=9007199254740991),
 check((kind='reserve' and available_before-available_after=amount_cents and reserved_after-reserved_before=amount_cents)
 or(kind='release' and available_after-available_before=amount_cents and reserved_before-reserved_after=amount_cents))
);
create index wallet_events_owner_page on public.wallet_reservation_events(user_id,created_at desc,id);
alter table public.wallet_accounts enable row level security;
alter table public.wallet_withdrawals enable row level security;
alter table public.wallet_reservation_events enable row level security;
revoke all on public.wallet_accounts,public.wallet_withdrawals,public.wallet_reservation_events from public,anon,authenticated,service_role;
grant select on public.wallet_accounts,public.wallet_withdrawals,public.wallet_reservation_events to authenticated,service_role;
create policy wallet_account_owner on public.wallet_accounts for select to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create policy wallet_withdrawal_owner on public.wallet_withdrawals for select to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create policy wallet_event_owner on public.wallet_reservation_events for select to authenticated using(user_id=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create function wellness_private.ensure_wallet_account() returns public.wallet_accounts language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid();result public.wallet_accounts;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise exception using errcode='42501',message='Carteira indisponível.';end if;
 perform p.id from public.profiles p where p.id=actor for update;
 if not found then raise exception using errcode='42501',message='Carteira indisponível.';end if;
 insert into public.wallet_accounts(user_id) values(actor) on conflict(user_id) do nothing;
 select * into result from public.wallet_accounts where user_id=actor;
 return result;
end $fn$;
create function wellness_private.reserve_wallet_withdrawal(p_request_id uuid,p_amount_cents bigint) returns public.wallet_withdrawals language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid();account public.wallet_accounts;result public.wallet_withdrawals;
begin
 if p_request_id is null or p_amount_cents is null or p_amount_cents<1 or p_amount_cents>9007199254740991 then raise exception using errcode='22023',message='Valor ou pedido inválido.';end if;
 perform wellness_private.ensure_wallet_account();
 select * into account from public.wallet_accounts where user_id=actor for update;
 select * into result from public.wallet_withdrawals where user_id=actor and request_id=p_request_id;
 if found then
  if result.amount_cents<>p_amount_cents then raise exception using errcode='23505',message='Pedido já utilizado.';end if;
  return result;
 end if;
 if account.available_cents<p_amount_cents then raise exception using errcode='22023',message='Saldo disponível insuficiente.';end if;
 insert into public.wallet_withdrawals(user_id,request_id,amount_cents) values(actor,p_request_id,p_amount_cents) returning * into result;
 update public.wallet_accounts set available_cents=available_cents-p_amount_cents,reserved_cents=reserved_cents+p_amount_cents,version=version+1,updated_at=now() where user_id=actor;
 insert into public.wallet_reservation_events(user_id,withdrawal_id,kind,amount_cents,account_version,available_before,available_after,reserved_before,reserved_after)
 values(actor,result.id,'reserve',p_amount_cents,account.version+1,account.available_cents,account.available_cents-p_amount_cents,account.reserved_cents,account.reserved_cents+p_amount_cents);
 return result;
end $fn$;
create function wellness_private.cancel_wallet_withdrawal(p_withdrawal_id uuid) returns public.wallet_withdrawals language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid();account public.wallet_accounts;result public.wallet_withdrawals;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_withdrawal_id is null then raise exception using errcode='42501',message='Reserva indisponível.';end if;
 select * into result from public.wallet_withdrawals where id=p_withdrawal_id;
 if not found or result.user_id<>actor then raise exception using errcode='42501',message='Reserva indisponível.';end if;
 perform wellness_private.ensure_wallet_account();
 select * into account from public.wallet_accounts where user_id=actor for update;
 select * into result from public.wallet_withdrawals where id=p_withdrawal_id for update;
 if result.status='cancelled' then return result;end if;
 if account.reserved_cents<result.amount_cents then raise exception using errcode='23514',message='Saldo reservado inconsistente.';end if;
 update public.wallet_accounts set available_cents=available_cents+result.amount_cents,reserved_cents=reserved_cents-result.amount_cents,version=version+1,updated_at=now() where user_id=actor;
 update public.wallet_withdrawals set status='cancelled',cancelled_at=now() where id=result.id returning * into result;
 insert into public.wallet_reservation_events(user_id,withdrawal_id,kind,amount_cents,account_version,available_before,available_after,reserved_before,reserved_after)
 values(actor,result.id,'release',result.amount_cents,account.version+1,account.available_cents,account.available_cents+result.amount_cents,account.reserved_cents,account.reserved_cents-result.amount_cents);
 return result;
end $fn$;
create function public.ensure_wallet_account() returns setof public.wallet_accounts language sql security invoker set search_path='' as $$select * from wellness_private.ensure_wallet_account()$$;
create function public.reserve_wallet_withdrawal(p_request_id uuid,p_amount_cents bigint) returns setof public.wallet_withdrawals language sql security invoker set search_path='' as $$select * from wellness_private.reserve_wallet_withdrawal(p_request_id,p_amount_cents)$$;
create function public.cancel_wallet_withdrawal(p_withdrawal_id uuid) returns setof public.wallet_withdrawals language sql security invoker set search_path='' as $$select * from wellness_private.cancel_wallet_withdrawal(p_withdrawal_id)$$;
revoke all on function wellness_private.ensure_wallet_account(),wellness_private.reserve_wallet_withdrawal(uuid,bigint),wellness_private.cancel_wallet_withdrawal(uuid),public.ensure_wallet_account(),public.reserve_wallet_withdrawal(uuid,bigint),public.cancel_wallet_withdrawal(uuid) from public,anon,authenticated,service_role;
grant execute on function wellness_private.ensure_wallet_account(),wellness_private.reserve_wallet_withdrawal(uuid,bigint),wellness_private.cancel_wallet_withdrawal(uuid),public.ensure_wallet_account(),public.reserve_wallet_withdrawal(uuid,bigint),public.cancel_wallet_withdrawal(uuid) to authenticated;
comment on table public.wallet_accounts is 'BRL cents. Zero opening balance. Funding and payment ledger are not implemented; API roles have no direct writes.';
comment on table public.wallet_withdrawals is 'Reservation request only. No PIX key, payment dispatch, settlement or real bank transfer.';
comment on table public.wallet_reservation_events is 'Atomic paired movement between available and reserved; API roles cannot insert/update/delete events. Not a complete double-entry payment ledger.';
