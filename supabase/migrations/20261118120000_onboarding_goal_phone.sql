-- Fase 1 do focus group (primeiro acesso):
-- 1) Objetivo principal da pessoa ("Defina seu objetivo" no caminho inicial). Visível só ao titular.
-- 2) Celular editável pela própria pessoa, inclusive quem entrou com Google (que não informa telefone).

create table public.account_goals (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 goal text not null check (goal in ('emagrecer','ganhar_massa','condicionamento','saude_bem_estar','dor_reabilitacao','performance','mente_estresse','alimentacao')),
 updated_at timestamptz not null default now()
);
alter table public.account_goals enable row level security;
revoke all on public.account_goals from public, anon, authenticated;
grant select on public.account_goals to authenticated;
grant select, insert, update, delete on public.account_goals to service_role;
create policy account_goals_read_self on public.account_goals for select to authenticated
 using (user_id = (select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false');
comment on table public.account_goals is 'Objetivo principal escolhido pela própria pessoa no caminho inicial. Lido só pelo titular.';

create function wellness_private.set_my_goal(p_goal text)
 returns public.account_goals language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result public.account_goals;
begin
 if p_goal is null or p_goal not in ('emagrecer','ganhar_massa','condicionamento','saude_bem_estar','dor_reabilitacao','performance','mente_estresse','alimentacao') then
  raise exception using errcode = '22023', message = 'Objetivo inválido.';
 end if;
 insert into public.account_goals (user_id, goal) values (actor, p_goal)
 on conflict (user_id) do update set goal = excluded.goal, updated_at = now()
 returning * into result;
 return result;
end $fn$;

-- Grava ou corrige o celular da própria conta (mesma validação do cadastro). Trocar o número zera a verificação.
create function wellness_private.set_my_phone(p_phone text)
 returns table (phone text, phone_verified_at timestamptz) language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_phone text := wellness_private.normalize_signup_phone(p_phone);
begin
 if v_phone is null then raise exception using errcode = '22023', message = 'Celular inválido.'; end if;
 insert into public.account_contacts (user_id, phone) values (actor, v_phone)
 on conflict (user_id) do update set phone = excluded.phone;
 return query select c.phone, c.phone_verified_at from public.account_contacts c where c.user_id = actor;
end $fn$;

create function public.set_my_goal(p_goal text) returns setof public.account_goals
 language sql security invoker set search_path = '' as $$select * from wellness_private.set_my_goal(p_goal)$$;
create function public.set_my_phone(p_phone text) returns table (phone text, phone_verified_at timestamptz)
 language sql security invoker set search_path = '' as $$select * from wellness_private.set_my_phone(p_phone)$$;

revoke all on function wellness_private.set_my_goal(text), public.set_my_goal(text),
 wellness_private.set_my_phone(text), public.set_my_phone(text) from public, anon, authenticated;
grant execute on function wellness_private.set_my_goal(text), public.set_my_goal(text),
 wellness_private.set_my_phone(text), public.set_my_phone(text) to authenticated;
