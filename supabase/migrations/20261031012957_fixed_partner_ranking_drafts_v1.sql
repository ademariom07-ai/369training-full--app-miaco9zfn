-- Draft-only version marker; no activation, point recalculation or money movement.
-- Historical rows and identical retries remain unchanged.
alter table public.ranking_policy_drafts drop constraint ranking_policy_drafts_partner_services_check;
alter table public.ranking_policy_drafts add constraint ranking_policy_drafts_partner_services_check
 check(partner_services in ('actual','floor_150','cap_150','fixed_150_weight_2_v1'));
alter table public.ranking_policy_drafts add constraint ranking_policy_drafts_fixed_rating_check
 check(partner_services<>'fixed_150_weight_2_v1' or rating='exact');
create or replace function wellness_private.create_ranking_policy_draft(p_request_id uuid,p_title text,p_notes text,p_referrals text,p_partner_services text,p_rating text,p_pool_basis text)
returns setof public.ranking_policy_drafts language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); existing public.ranking_policy_drafts; label text:=btrim(p_title); explanation text:=btrim(p_notes);
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then raise insufficient_privilege using message='Admin required';end if;
 perform 1 from public.profiles where id=actor and role='admin' for update;
 if not found then raise insufficient_privilege using message='Admin required';end if;
 if p_request_id is null or label is null or char_length(label) not between 1 and 120 or explanation is null or char_length(explanation)>2000
 or p_referrals is null or p_referrals not in ('minimum_one','plus_one','legacy_divisor_18')
 or p_partner_services is null or p_partner_services not in ('actual','floor_150','cap_150','fixed_150_weight_2_v1')
 or p_rating is null or p_rating not in ('rounded','exact')
 or p_pool_basis is null or p_pool_basis not in ('tarifas_only','tarifas_and_monthly','weighted_tarifas_monthly') then raise invalid_parameter_value using message='Invalid draft';end if;
 select * into existing from public.ranking_policy_drafts where created_by=actor and request_id=p_request_id;
 if found then
  if existing.title<>label or existing.notes<>explanation or existing.referrals<>p_referrals or existing.partner_services<>p_partner_services or existing.rating<>p_rating or existing.pool_basis<>p_pool_basis then raise unique_violation using message='Request already used';end if;
  return next existing;return;
 end if;
 if p_partner_services<>'fixed_150_weight_2_v1' or p_rating<>'exact' then raise invalid_parameter_value using message='New drafts require fixed 150, weight 2, exact rating (v1)';end if;
 insert into public.ranking_policy_drafts(request_id,created_by,title,notes,referrals,partner_services,rating,pool_basis)
 values(p_request_id,actor,label,explanation,p_referrals,p_partner_services,p_rating,p_pool_basis) returning * into existing;
 return next existing;return;
end $fn$;
