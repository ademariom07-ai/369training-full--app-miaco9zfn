-- All test users/rows and role changes roll back inside the exception block.
-- No credentials, emails, external messages or durable synthetic accounts.
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid(); n integer; checks integer := 0;
begin
  begin
    insert into auth.users(id) values (a),(b),(c),(d);
    insert into public.profiles(id,display_name,role,approved) values (b,'Professional','profissional',true),(c,'Admin','admin',true);
    perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated','is_anonymous',false,'user_metadata',json_build_object('role','admin','approved',true))::text,true);
    set local role authenticated;
    insert into public.profiles(id,display_name) values (a,'Student');
    if (select role from public.profiles where id=a) <> 'aluno' or (select approved from public.profiles where id=a) then raise exception 'metadata escalated privileges'; end if; checks:=checks+1;
    select count(*) into n from public.profiles; if n<>1 then raise exception 'student sees another account'; end if; checks:=checks+1;
    update public.profiles set display_name='Updated' where id=a;
    if (select display_name from public.profiles where id=a)<>'Updated' then raise exception 'self update failed'; end if; checks:=checks+1;
    update public.profiles set display_name='Intrusion' where id=b;
    get diagnostics n=row_count; if n<>0 then raise exception 'other account updated'; end if; checks:=checks+1;
    begin update public.profiles set role='admin' where id=a; raise exception 'role escalation allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    begin update public.profiles set approved=true where id=a; raise exception 'approval escalation allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    begin update public.profiles set id=d where id=a; raise exception 'identity transfer allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    begin insert into public.profiles(id,display_name) values(d,'Wrong owner'); raise exception 'other profile insert allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    begin delete from public.profiles where id=a; raise exception 'client delete allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated','is_anonymous',false)::text,true);
    select count(*) into n from public.profiles; if n<>1 or not exists(select 1 from public.profiles where id=b) then raise exception 'professional isolation failed'; end if; checks:=checks+1;
    perform set_config('request.jwt.claims',json_build_object('sub',c,'role','authenticated','is_anonymous',false)::text,true);
    select count(*) into n from public.profiles; if n<>1 or not exists(select 1 from public.profiles where id=c) then raise exception 'admin blanket access granted'; end if; checks:=checks+1;
    perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated','is_anonymous',true)::text,true);
    select count(*) into n from public.profiles; if n<>0 then raise exception 'anonymous auth reads profile'; end if; checks:=checks+1;
    begin insert into public.profiles(id,display_name) values(d,'Anonymous'); raise exception 'anonymous write allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    set local role anon;
    begin perform id from public.profiles; raise exception 'anon table access allowed'; exception when insufficient_privilege then checks:=checks+1; end;
    reset role;
    if (select display_name from public.profiles where id=b)<>'Professional' then raise exception 'other account changed'; end if;
    if checks<>14 then raise exception 'unexpected check count %',checks; end if;
    raise sqlstate 'W3690' using message='14 profile security checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
