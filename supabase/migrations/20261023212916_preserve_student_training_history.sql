-- Preserve the recipient's read access without widening professional access
-- or permission to create/complete plans after the relationship ends.
create policy training_plans_recipient_history on public.training_plans
 for select to authenticated
 using (
  student_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'is_anonymous'),'false') = 'false'
 );

-- Reading a notification is a recipient-only action, including old plans.
create or replace function wellness_private.read_training_notification(p_plan_id uuid)
 returns public.training_plan_notifications language plpgsql security definer set search_path='' as $fn$
declare actor uuid:=auth.uid(); plan public.training_plans; result public.training_plan_notifications;
begin
 if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')<>'false' or p_plan_id is null then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 select * into plan from public.training_plans where id=p_plan_id;
 if not found or plan.student_id<>actor then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 update public.training_plan_notifications set read_at=coalesce(read_at,now()) where plan_id=p_plan_id and recipient_id=actor returning * into result;
 if not found then raise exception using errcode='42501',message='Aviso indisponível.';end if;
 return result;
end $fn$;
revoke all on function wellness_private.read_training_notification(uuid) from public,anon;
grant execute on function wellness_private.read_training_notification(uuid) to authenticated;
