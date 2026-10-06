-- Minimal directory for signed-in students. Does not widen profiles RLS.
create index profiles_approved_directory_idx on public.profiles(display_name,id)
 where role='profissional' and approved and btrim(display_name)<>'';
create function wellness_private.list_approved_professionals(p_page integer)
 returns table(professional_id uuid,display_name text)
 language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
   or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='aluno') then
   raise exception using errcode='42501',message='Catálogo indisponível.';
 end if;
 if p_page is null or p_page<1 or p_page>10000 then
   raise exception using errcode='22023',message='Página inválida.';
 end if;
 return query select p.id,p.display_name from public.profiles p
  where p.role='profissional' and p.approved and btrim(p.display_name)<>''
  order by p.display_name,p.id limit 20 offset (p_page-1)*20;
end $fn$;
create function public.list_approved_professionals(p_page integer)
 returns table(professional_id uuid,display_name text)
 language sql stable security invoker set search_path='' as $fn$
 select * from wellness_private.list_approved_professionals(p_page)
$fn$;
revoke all on function wellness_private.list_approved_professionals(integer),public.list_approved_professionals(integer) from public,anon,authenticated;
grant execute on function wellness_private.list_approved_professionals(integer),public.list_approved_professionals(integer) to authenticated;
comment on function public.list_approved_professionals(integer) is 'Student-only directory: approved professional display name and identifier, twenty per page. No contact, clinical information, or general profile access. Approval checked again when requesting a relationship.';
