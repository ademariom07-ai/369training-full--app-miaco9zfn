create table public.training_completions (
 plan_id uuid primary key,
 student_id uuid not null,
 completed_at timestamptz not null default now(),
 foreign key(plan_id,student_id) references public.training_plans(id,student_id) on delete cascade
);
create index training_completions_student_idx on public.training_completions(student_id,completed_at desc);
alter table public.training_completions enable row level security;
revoke all on public.training_completions from public,anon,authenticated;
grant select on public.training_completions to authenticated;
grant select,insert,update,delete on public.training_completions to service_role;
create policy training_completion_current_participants on public.training_completions for select to authenticated
 using(exists(select 1 from public.training_plans p where p.id=plan_id));
create function wellness_private.complete_training_plan(p_plan_id uuid)
 returns public.training_completions language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); plan public.training_plans; result public.training_completions;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_plan_id is null then raise exception using errcode='42501',message='Registro indisponível.';end if;
 select * into plan from public.training_plans where id=p_plan_id;
 if not found or plan.student_id<>actor then raise exception using errcode='42501',message='Registro indisponível.';end if;
 perform p.id from public.profiles p where p.id in(plan.student_id,plan.professional_id) order by p.id for update;
 if not wellness_private.can_access_training_plan(plan.student_id,plan.professional_id,plan.link_version) then raise exception using errcode='42501',message='Registro indisponível.';end if;
 insert into public.training_completions(plan_id,student_id) values(plan.id,actor) on conflict(plan_id) do nothing;
 select * into result from public.training_completions where plan_id=plan.id;
 return result;
end $fn$;
create function public.complete_training_plan(p_plan_id uuid) returns setof public.training_completions language sql security invoker set search_path='' as $$select * from wellness_private.complete_training_plan(p_plan_id)$$;
revoke all on function wellness_private.complete_training_plan(uuid),public.complete_training_plan(uuid) from public,anon,authenticated;
grant execute on function wellness_private.complete_training_plan(uuid),public.complete_training_plan(uuid) to authenticated;
comment on table public.training_completions is 'One server-timestamped self-reported completion per publication. Not exercise-by-exercise, repeated sessions, wearable proof, notice read, or ranking credit.';
