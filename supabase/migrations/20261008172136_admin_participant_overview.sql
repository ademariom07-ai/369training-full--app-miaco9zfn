-- Read-only administrative operational data; no clinical, split or payment details.
create index profiles_admin_participant_name_idx on public.profiles(display_name,id) where role in('aluno','profissional');
create function wellness_private.admin_participant_overview(p_page integer,p_query text)
returns table(participant_id uuid,display_name text,participant_role text,professional_approved boolean,joined_at timestamptz,wallet_initialized boolean,available_cents bigint,reserved_cents bigint,wallet_version bigint,wallet_updated_at timestamptz,esg_pending bigint,esg_approved bigint,esg_rejected bigint,checked_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception using errcode='42501',message='Consulta administrativa indisponível.';end if;
 if p_page is null or p_page<1 or p_page>10000 or p_query is null or char_length(p_query)>120 then raise exception using errcode='22023',message='Consulta inválida.';end if;
 return query
 with participants as (
  select p.id,p.display_name,p.role,p.approved,p.created_at from public.profiles p
  where p.role in('aluno','profissional') and (btrim(p_query)='' or strpos(lower(p.display_name),lower(btrim(p_query)))>0 or p.id::text=lower(btrim(p_query)))
  order by p.display_name,p.id limit 20 offset (p_page-1)*20
 )
 select p.id,p.display_name,p.role,p.approved,p.created_at,w.user_id is not null,w.available_cents,w.reserved_cents,w.version,w.updated_at,
 (select count(*) from public.esg_projects e where e.owner_id=p.id and e.status='pending'),
 (select count(*) from public.esg_projects e where e.owner_id=p.id and e.status='approved'),
 (select count(*) from public.esg_projects e where e.owner_id=p.id and e.status='rejected'),now()
 from participants p left join public.wallet_accounts w on w.user_id=p.id order by p.display_name,p.id;
end $fn$;
create function public.admin_participant_overview(p_page integer,p_query text)
returns table(participant_id uuid,display_name text,participant_role text,professional_approved boolean,joined_at timestamptz,wallet_initialized boolean,available_cents bigint,reserved_cents bigint,wallet_version bigint,wallet_updated_at timestamptz,esg_pending bigint,esg_approved bigint,esg_rejected bigint,checked_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from wellness_private.admin_participant_overview(p_page,p_query)$$;
revoke all on function wellness_private.admin_participant_overview(integer,text),public.admin_participant_overview(integer,text) from public,anon,authenticated,service_role;
grant execute on function wellness_private.admin_participant_overview(integer,text),public.admin_participant_overview(integer,text) to authenticated;
comment on function public.admin_participant_overview(integer,text) is 'Admin-only read-only paginated participant overview. Missing wallets return null monetary fields. ESG approval counts are not financially eligible project counts. No change to profiles or wallets RLS.';
