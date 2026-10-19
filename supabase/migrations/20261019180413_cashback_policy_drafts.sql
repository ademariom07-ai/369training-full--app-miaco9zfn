-- Immutable proposals only. No activation endpoint and no financial side effects.
create table public.cashback_policy_drafts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 title text not null check(title=btrim(title) and char_length(title) between 1 and 120),
 top_pool_percent integer not null check(top_pool_percent between 1 and 99),
 top_participants_percent integer not null check(top_participants_percent between 1 and 99),
 top_ratio integer not null check(top_ratio between 1 and 100),
 status text not null default 'draft' check(status='draft'),
 algorithm_version text not null default 'pareto-configurable-v1' check(algorithm_version='pareto-configurable-v1'),
 unique(created_by,request_id)
);
create index cashback_policy_drafts_history on public.cashback_policy_drafts(created_at desc,id);
alter table public.cashback_policy_drafts enable row level security;
revoke all on public.cashback_policy_drafts from public,anon,authenticated,service_role;
grant select on public.cashback_policy_drafts to authenticated;
create policy cashback_draft_admin_read on public.cashback_policy_drafts for select to authenticated using (
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
create function wellness_private.create_cashback_policy_draft(p_request_id uuid,p_title text,p_top_pool_percent integer,p_top_participants_percent integer,p_top_ratio integer)
returns setof public.cashback_policy_drafts language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); existing public.cashback_policy_drafts; label text:=btrim(p_title);
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Admin required';end if;
 perform 1 from public.profiles where id=actor and role='admin' for update;
 if not found then raise insufficient_privilege using message='Admin required';end if;
 if p_request_id is null or label is null or char_length(label) not between 1 and 120
 or p_top_pool_percent is null or p_top_pool_percent not between 1 and 99
 or p_top_participants_percent is null or p_top_participants_percent not between 1 and 99
 or p_top_ratio is null or p_top_ratio not between 1 and 100 then raise invalid_parameter_value using message='Invalid cashback draft';end if;
 select * into existing from public.cashback_policy_drafts where created_by=actor and request_id=p_request_id;
 if found then
  if row(existing.title,existing.top_pool_percent,existing.top_participants_percent,existing.top_ratio) is distinct from row(label,p_top_pool_percent,p_top_participants_percent,p_top_ratio) then raise unique_violation using message='Request already used';end if;
  return next existing;return;
 end if;
 insert into public.cashback_policy_drafts(request_id,created_by,title,top_pool_percent,top_participants_percent,top_ratio)
 values(p_request_id,actor,label,p_top_pool_percent,p_top_participants_percent,p_top_ratio) returning * into existing;
 return next existing;
end $fn$;
create function public.create_cashback_policy_draft(p_request_id uuid,p_title text,p_top_pool_percent integer,p_top_participants_percent integer,p_top_ratio integer)
returns setof public.cashback_policy_drafts language sql security invoker set search_path='' as $fn$
 select * from wellness_private.create_cashback_policy_draft(p_request_id,p_title,p_top_pool_percent,p_top_participants_percent,p_top_ratio);
$fn$;
revoke all on function wellness_private.create_cashback_policy_draft(uuid,text,integer,integer,integer),public.create_cashback_policy_draft(uuid,text,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function wellness_private.create_cashback_policy_draft(uuid,text,integer,integer,integer),public.create_cashback_policy_draft(uuid,text,integer,integer,integer) to authenticated;
comment on table public.cashback_policy_drafts is 'Administrative immutable proposals only. Saving is NOT activation or proof of feasible distribution. Before any future activation, simulate exact pool and eligible population, reject payout inversions, bind the approved snapshot to a monthly period, and enforce financial authorization.';
