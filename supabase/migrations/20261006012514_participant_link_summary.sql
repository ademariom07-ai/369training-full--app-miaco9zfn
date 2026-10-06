-- Scope is derived from auth.uid(), never a caller-supplied participant ID.
-- Only the current counterpart name is projected; revoked links expose no name.
create function wellness_private.list_participant_links(p_page integer)
 returns table(student_id uuid,professional_id uuid,state text,version bigint,requested_at timestamptz,accepted_at timestamptz,revoked_at timestamptz,participant_name text)
 language plpgsql stable security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); actor_role text;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' then
  raise exception using errcode='42501',message='Vínculos indisponíveis.';
 end if;
 select p.role into actor_role from public.profiles p where p.id=actor and (p.role='aluno' or p.role='profissional' and p.approved);
 if actor_role is null then raise exception using errcode='42501',message='Vínculos indisponíveis.';end if;
 if p_page is null or p_page<1 or p_page>10000 or actor_role='aluno' and p_page<>1 then
  raise exception using errcode='22023',message='Página inválida.';
 end if;
 return query
  select l.student_id,l.professional_id,l.state,l.version,l.requested_at,l.accepted_at,l.revoked_at,
   case when l.state in ('pending','active') and
    (actor_role='aluno' and counterpart.role='profissional' and counterpart.approved or actor_role='profissional' and counterpart.role='aluno')
    then nullif(btrim(counterpart.display_name),'') else null end
  from public.student_professional_links l
  left join public.profiles counterpart on counterpart.id=case when actor_role='aluno' then l.professional_id else l.student_id end
  where actor_role='aluno' and l.student_id=actor or actor_role='profissional' and l.professional_id=actor
  order by l.requested_at desc,l.student_id limit 20 offset (p_page-1)*20;
end $fn$;
create function public.list_participant_links(p_page integer)
 returns table(student_id uuid,professional_id uuid,state text,version bigint,requested_at timestamptz,accepted_at timestamptz,revoked_at timestamptz,participant_name text)
 language sql stable security invoker set search_path='' as $fn$
 select * from wellness_private.list_participant_links(p_page)
$fn$;
revoke all on function wellness_private.list_participant_links(integer),public.list_participant_links(integer) from public,anon,authenticated;
grant execute on function wellness_private.list_participant_links(integer),public.list_participant_links(integer) to authenticated;
comment on function public.list_participant_links(integer) is 'Own relationship rows plus minimal current counterpart name. Approved professionals only; no names after revocation or counterpart role/approval loss. Does not grant profile or clinical access.';
