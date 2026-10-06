-- SQL role/claim checks; all fixtures roll back, not real JWT/login tests.
begin;
do $test$
declare a uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); checks integer:=0;
begin
 begin
  insert into auth.users(id) values(a),(p),(u),(z),(b);
  insert into public.profiles(id,display_name,role,approved) values(a,'Student fixture','aluno',false),(p,'Approved fixture','profissional',true),(u,'Unapproved fixture','profissional',false),(z,'Admin fixture','admin',true),(b,' ','profissional',true);
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false,'user_metadata',json_build_object('role','admin'))::text,true);
  if not exists(select 1 from public.list_approved_professionals(1) d where d.professional_id=p and d.display_name='Approved fixture') then raise exception 'approved provider missing';end if;checks:=checks+1;
  if exists(select 1 from public.list_approved_professionals(1) d where d.professional_id in (a,u,z,b)) then raise exception 'private or ineligible names exposed';end if;checks:=checks+1;
  if (select count(*) from public.list_approved_professionals(1))>20 then raise exception 'page unbounded';end if;checks:=checks+1;
  if exists(select 1 from public.list_approved_professionals(1) x join public.list_approved_professionals(2) y using(professional_id)) then raise exception 'pages overlap';end if;checks:=checks+1;
  if exists(select 1 from public.profiles where id in(p,u,z,b)) then raise exception 'profiles RLS widened';end if;checks:=checks+1;
  begin perform public.list_approved_professionals(0);raise exception 'page zero allowed';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.list_approved_professionals(10001);raise exception 'page excessive allowed';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.list_approved_professionals(null);raise exception 'null page allowed';exception when invalid_parameter_value then checks:=checks+1;end;
  reset role;update public.profiles set approved=false where id=p;set local role authenticated;
  if exists(select 1 from public.list_approved_professionals(1) d where d.professional_id=p) then raise exception 'revoked approval still listed';end if;checks:=checks+1;
  begin perform public.request_student_link(p);raise exception 'revoked approval requested';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',true)::text,true);
  begin perform public.list_approved_professionals(1);raise exception 'anonymous Auth allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',z,'is_anonymous',false)::text,true);
  begin perform public.list_approved_professionals(1);raise exception 'admin directory allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  begin perform public.list_approved_professionals(1);raise exception 'professional directory allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims','{}',true);
  begin perform public.list_approved_professionals(1);raise exception 'missing subject allowed';exception when insufficient_privilege then checks:=checks+1;end;
  set local role anon;
  begin perform public.list_approved_professionals(1);raise exception 'anon EXEC allowed';exception when insufficient_privilege then checks:=checks+1;end;
  reset role;if checks<>15 then raise exception 'unexpected checks %',checks;end if;
  raise sqlstate 'W3691' using message='15 directory checks passed; rollback fixtures';
 exception when sqlstate 'W3691' then null;
 end;
end $test$;
rollback;
