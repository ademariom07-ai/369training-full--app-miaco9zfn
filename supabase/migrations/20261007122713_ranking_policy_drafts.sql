-- Immutable review drafts only. No activation, settlement or wallet credit endpoint.
create table public.ranking_policy_drafts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 title text not null check(title=btrim(title) and char_length(title) between 1 and 120),
 notes text not null default '' check(notes=btrim(notes) and char_length(notes)<=2000),
 referrals text not null check(referrals in ('minimum_one','plus_one','legacy_divisor_18')),
 partner_services text not null check(partner_services in ('actual','floor_150','cap_150')),
 rating text not null check(rating in ('rounded','exact')),
 pool_basis text not null check(pool_basis in ('tarifas_only','tarifas_and_monthly','weighted_tarifas_monthly')),
 unique(created_by,request_id)
);
create index ranking_policy_drafts_history on public.ranking_policy_drafts(created_at desc,id);
alter table public.ranking_policy_drafts enable row level security;
revoke all on public.ranking_policy_drafts from public,anon,authenticated,service_role;
grant select on public.ranking_policy_drafts to authenticated,service_role;
create policy admin_draft_read on public.ranking_policy_drafts for select to authenticated using (
 coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
);
create function wellness_private.create_ranking_policy_draft(p_request_id uuid,p_title text,p_notes text,p_referrals text,p_partner_services text,p_rating text,p_pool_basis text)
returns setof public.ranking_policy_drafts language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); existing public.ranking_policy_drafts; label text:=btrim(p_title); explanation text:=btrim(p_notes);
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Admin required';end if;
 perform 1 from public.profiles where id=actor and role='admin' for update;
 if not found then raise insufficient_privilege using message='Admin required';end if;
 if p_request_id is null or label is null or char_length(label) not between 1 and 120 or explanation is null or char_length(explanation)>2000
 or p_referrals is null or p_referrals not in ('minimum_one','plus_one','legacy_divisor_18')
 or p_partner_services is null or p_partner_services not in ('actual','floor_150','cap_150')
 or p_rating is null or p_rating not in ('rounded','exact')
 or p_pool_basis is null or p_pool_basis not in ('tarifas_only','tarifas_and_monthly','weighted_tarifas_monthly') then raise invalid_parameter_value using message='Invalid draft';end if;
 select * into existing from public.ranking_policy_drafts where created_by=actor and request_id=p_request_id;
 if found then
  if existing.title<>label or existing.notes<>explanation or existing.referrals<>p_referrals or existing.partner_services<>p_partner_services or existing.rating<>p_rating or existing.pool_basis<>p_pool_basis then raise unique_violation using message='Request already used';end if;
  return next existing;return;
 end if;
 insert into public.ranking_policy_drafts(request_id,created_by,title,notes,referrals,partner_services,rating,pool_basis)
 values(p_request_id,actor,label,explanation,p_referrals,p_partner_services,p_rating,p_pool_basis) returning * into existing;
 return next existing;return;
end $fn$;
create function public.create_ranking_policy_draft(p_request_id uuid,p_title text,p_notes text,p_referrals text,p_partner_services text,p_rating text,p_pool_basis text)
returns setof public.ranking_policy_drafts language sql security invoker set search_path='' as $fn$
 select * from wellness_private.create_ranking_policy_draft(p_request_id,p_title,p_notes,p_referrals,p_partner_services,p_rating,p_pool_basis);
$fn$;
revoke all on function wellness_private.create_ranking_policy_draft(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.create_ranking_policy_draft(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function wellness_private.create_ranking_policy_draft(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.create_ranking_policy_draft(uuid,text,text,text,text,text,text) to authenticated;
