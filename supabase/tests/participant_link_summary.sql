begin;
-- SQL roles/claims, not real login/JWT tests. Outer rollback plus fixture subtransaction.
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); f uuid; checks integer:=0;
begin
 begin
  insert into auth.users(id) values(a),(b),(p),(q),(z);
  insert into public.profiles(id,display_name,role,approved) values(a,'Student name','aluno',false),(b,'Other student','aluno',false),(p,'Professional name','profissional',true),(q,'Other professional','profissional',true),(z,'Admin','admin',true);
  set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
  perform public.request_student_link(p);
  if not exists(select 1 from public.list_participant_links(1) where student_id=a and professional_id=p and state='pending' and participant_name='Professional name') then raise exception 'student pending name missing';end if;checks:=checks+1;
  if exists(select 1 from public.profiles where id=p) then raise exception 'profiles RLS widened';end if;checks:=checks+1;
  begin perform public.list_participant_links(2);raise exception 'student extra page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',b,'is_anonymous',false)::text,true);
  if exists(select 1 from public.list_participant_links(1)) then raise exception 'other student sees names';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',q,'is_anonymous',false)::text,true);
  if exists(select 1 from public.list_participant_links(1)) then raise exception 'other professional sees names';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  if not exists(select 1 from public.list_participant_links(1) where student_id=a and participant_name='Student name') then raise exception 'professional pending name missing';end if;checks:=checks+1;
  perform public.accept_student_link(a,1);
  if not exists(select 1 from public.list_participant_links(1) where state='active' and participant_name='Student name') then raise exception 'active name missing';end if;checks:=checks+1;
  perform public.revoke_student_link(a,1);
  if not exists(select 1 from public.list_participant_links(1) where state='revoked' and participant_name is null) then raise exception 'revoked professional name leak';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
  if not exists(select 1 from public.list_participant_links(1) where state='revoked' and participant_name is null) then raise exception 'revoked student name leak';end if;checks:=checks+1;
  perform public.request_student_link(q);
  if not exists(select 1 from public.list_participant_links(1) where professional_id=q and participant_name='Other professional' and version=2) then raise exception 'replaced counterpart wrong';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  if exists(select 1 from public.list_participant_links(1)) then raise exception 'former professional sees new relation';end if;checks:=checks+1;
  reset role;
  for i in 1..21 loop
   f:=gen_random_uuid();insert into auth.users(id) values(f);insert into public.profiles(id,display_name) values(f,'Page student');insert into public.student_professional_links(student_id,professional_id,state) values(f,q,'pending');
  end loop;
  set local role authenticated;perform set_config('request.jwt.claims',json_build_object('sub',q,'is_anonymous',false)::text,true);
  if (select count(*) from public.list_participant_links(1))<>20 or (select count(*) from public.list_participant_links(2))<>2 then raise exception 'pagination unbounded or truncated';end if;checks:=checks+1;
  if exists(select 1 from public.list_participant_links(1) x join public.list_participant_links(2) y using(student_id)) then raise exception 'pages overlap';end if;checks:=checks+1;
  begin perform public.list_participant_links(0);raise exception 'zero page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.list_participant_links(10001);raise exception 'excessive page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  begin perform public.list_participant_links(null);raise exception 'null page accepted';exception when invalid_parameter_value then checks:=checks+1;end;
  reset role;update public.profiles set approved=false where id=q;set local role authenticated;
  begin perform public.list_participant_links(1);raise exception 'unapproved professional sees names';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
  if not exists(select 1 from public.list_participant_links(1) where professional_id=q and participant_name is null) then raise exception 'unapproved counterpart name leak';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',z,'is_anonymous',false,'user_metadata',json_build_object('role','profissional'))::text,true);
  begin perform public.list_participant_links(1);raise exception 'admin names allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',true)::text,true);
  begin perform public.list_participant_links(1);raise exception 'anonymous Auth names allowed';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims','{}',true);
  begin perform public.list_participant_links(1);raise exception 'missing uid allowed';exception when insufficient_privilege then checks:=checks+1;end;
  set local role anon;
  begin perform public.list_participant_links(1);raise exception 'anon execute allowed';exception when insufficient_privilege then checks:=checks+1;end;
  reset role;if checks<>22 then raise exception 'unexpected checks %',checks;end if;
  raise sqlstate 'W3691' using message='22 summary checks passed; rollback fixtures';
 exception when sqlstate 'W3691' then null;
 end;
end $test$;
rollback;
