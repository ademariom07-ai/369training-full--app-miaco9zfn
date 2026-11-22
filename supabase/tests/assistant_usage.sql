-- Uso da assistente: só a chave de serviço acessa. Tudo é desfeito no final.
do $test$
declare checks integer := 0;
begin
  begin
    set local role authenticated;
    begin perform 1 from public.assistant_calls limit 1; raise exception 'readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    begin insert into public.assistant_calls(user_id) values (gen_random_uuid()); raise exception 'writable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    set local role anon;
    begin perform 1 from public.assistant_calls limit 1; raise exception 'anon readable';
    exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 3 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '3 assistant checks passed';
  exception when sqlstate 'W3690' then null;
  end;
end $test$;
