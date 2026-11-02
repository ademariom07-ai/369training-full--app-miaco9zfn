begin;
do $qa$
declare a uuid:=gen_random_uuid();s uuid:=gen_random_uuid();p uuid:=gen_random_uuid();
begin
 if exists(select 1 from wellness_private.booking_hold_policy) then raise exception 'Use an isolated database for QA';end if;
 insert into auth.users(id) values(a),(s),(p);
 insert into public.profiles(id,display_name,role,approved) values(a,'Admin QA','admin',true),(s,'Aluno QA','aluno',false),(p,'Prof QA','profissional',true);
 set local role authenticated;
 perform set_config('request.jwt.claims',json_build_object('sub',s,'is_anonymous',false,'user_metadata',json_build_object('role','admin'))::text,true);
 if public.booking_hold_minutes()<>0 then raise exception 'Expected paused pilot';end if;
 begin perform public.set_booking_hold_minutes(0,12);raise exception 'spoofed admin';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
 begin perform public.set_booking_hold_minutes(0,12);raise exception 'professional changed policy';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
 begin perform public.set_booking_hold_minutes(0,1441);raise exception 'invalid duration';exception when invalid_parameter_value then null;end;
 perform public.set_booking_hold_minutes(0,12);
 begin perform public.set_booking_hold_minutes(0,8);raise exception 'stale write';exception when serialization_failure then null;end;
 if public.booking_hold_minutes()<>12 then raise exception 'duration missing';end if;
 perform public.set_booking_hold_minutes(12,0);
 if public.booking_hold_minutes()<>0 then raise exception 'pause failed';end if;
 reset role;
 if (select count(*) from wellness_private.booking_hold_policy_changes where actor=a)<>2 then raise exception 'audit missing';end if;
end $qa$;
rollback;
