-- Identity foundation only. No PocketBase data or passwords are imported.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 160),
  role text not null default 'aluno' check (role in ('aluno','profissional','admin')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Explicit grants: table-wide INSERT/UPDATE would defeat column restrictions.
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role = 'aluno' and approved = false
    and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false')
  with check (id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.profiles is 'Own-account identity only. Roles/approval require trusted backend administration. Clinical/contact data and public professional directory are separate future modules.';
-- An existing event-trigger helper is not an RPC for application users.
-- Keep the trigger/function itself intact; remove client EXECUTE only.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$migration$;
