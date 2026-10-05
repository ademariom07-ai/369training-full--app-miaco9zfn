-- Explicit outer transaction guarantees no fixture can persist.
begin;
-- SQL role/claim tests, not login/JWT signature tests. Every fixture rolls back.
do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); r public.student_professional_links; n integer; checks integer:=0;
begin
 begin
  insert into auth.users(id) values(a),(b),(p),(q),(u),(z);
  insert into public.profiles(id,role,approved) values(a,'aluno',false),(b,'aluno',false),(p,'profissional',true),(q,'profissional',true),(u,'profissional',false),(z,'admin',true);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false,'user_metadata',json_build_object('role','admin'))::text,true);set local role authenticated;
  select * into r from public.request_student_link(p);if r.student_id<>a or r.professional_id<>p or r.state<>'pending' or r.version<>1 then raise exception 'request incorrect';end if;checks:=checks+1;
  select * into r from public.request_student_link(p);if r.version<>1 or (select count(*) from public.student_professional_links)<>1 then raise exception 'duplicate request';end if;checks:=checks+1;
  begin perform public.request_student_link(u);raise exception 'unapproved provider accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform public.accept_student_link(a,1);raise exception 'student self-accepted';exception when insufficient_privilege then checks:=checks+1;end;
  begin insert into public.student_professional_links(student_id,professional_id,state) values(b,p,'pending');raise exception 'direct insert permitted';exception when insufficient_privilege then checks:=checks+1;end;
  begin update public.student_professional_links set state='active',accepted_at=now() where student_id=a;raise exception 'direct update permitted';exception when insufficient_privilege then checks:=checks+1;end;
  begin delete from public.student_professional_links where student_id=a;raise exception 'direct delete permitted';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',b,'is_anonymous',false)::text,true);
  if (select count(*) from public.student_professional_links)<>0 then raise exception 'other pupil reads link';end if;checks:=checks+1;
  begin perform public.revoke_student_link(a,1);raise exception 'other pupil revoked';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',q,'is_anonymous',false)::text,true);
  begin perform public.accept_student_link(a,1);raise exception 'other provider accepted';exception when insufficient_privilege then checks:=checks+1;end;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  select * into r from public.accept_student_link(a,1);if r.state<>'active' or r.accepted_at is null then raise exception 'accept failed';end if;checks:=checks+1;
  select * into r from public.accept_student_link(a,1);if r.state<>'active' or r.version<>1 then raise exception 'repeat accept changed version';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);
  begin perform public.request_student_link(q);raise exception 'active provider replaced';exception when unique_violation then checks:=checks+1;end;
  begin perform public.revoke_student_link(a,99);raise exception 'stale revoke accepted';exception when insufficient_privilege then checks:=checks+1;end;
  select * into r from public.revoke_student_link(a,1);if r.state<>'revoked' or r.revoked_at is null then raise exception 'revoke failed';end if;checks:=checks+1;
  select * into r from public.revoke_student_link(a,1);if r.state<>'revoked' or r.version<>1 then raise exception 'repeat revoke changed version';end if;checks:=checks+1;
  select * into r from public.request_student_link(p);if r.state<>'pending' or r.version<>2 or r.accepted_at is not null then raise exception 'new request version incorrect';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  begin perform public.accept_student_link(a,1);raise exception 'old request accepted';exception when insufficient_privilege then checks:=checks+1;end;
  select * into r from public.accept_student_link(a,2);if r.state<>'active' then raise exception 'new accept failed';end if;checks:=checks+1;
  select * into r from public.revoke_student_link(a,2);if r.state<>'revoked' then raise exception 'provider revoke failed';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',false)::text,true);perform public.request_student_link(p);
  reset role;update public.profiles set approved=false where id=p;set local role authenticated;
  perform set_config('request.jwt.claims',json_build_object('sub',p,'is_anonymous',false)::text,true);
  begin perform public.accept_student_link(a,3);raise exception 'revoked approval accepted';exception when insufficient_privilege then checks:=checks+1;end;
  if (select count(*) from public.student_professional_links)<>0 then raise exception 'unapproved provider reads link';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',z,'is_anonymous',false)::text,true);
  if (select count(*) from public.student_professional_links)<>0 then raise exception 'admin blanket link access';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',json_build_object('sub',a,'is_anonymous',true)::text,true);
  begin perform public.request_student_link(q);raise exception 'anonymous auth requested';exception when insufficient_privilege then checks:=checks+1;end;
  if (select count(*) from public.student_professional_links)<>0 then raise exception 'anonymous auth reads';end if;checks:=checks+1;
  set local role anon;
  begin perform public.request_student_link(q);raise exception 'anon RPC permitted';exception when insufficient_privilege then checks:=checks+1;end;
  begin perform student_id from public.student_professional_links;raise exception 'anon table read permitted';exception when insufficient_privilege then checks:=checks+1;end;
  reset role;if checks<>27 then raise exception 'unexpected checks %',checks;end if;
  raise sqlstate 'W3691' using message='27 checks passed; rollback fixtures';
 exception when sqlstate 'W3691' then null;
 end;
end $test$;

rollback;
