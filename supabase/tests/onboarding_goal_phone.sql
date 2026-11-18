-- Objetivo e celular do caminho inicial: só o titular grava e lê.
do $test$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); n integer; t text; checks integer := 0;
begin
  begin
    insert into auth.users(id, raw_user_meta_data) values (a, '{"full_name":"Ana Google"}'), (b, '{"full_name":"Bia Aluna","phone":"11987654321"}');
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select goal into t from public.set_my_goal('emagrecer'); if t <> 'emagrecer' then raise exception 'goal not saved'; end if; checks := checks + 1;
    perform public.set_my_goal('condicionamento');
    if (select goal from public.account_goals) <> 'condicionamento' then raise exception 'goal not updated'; end if; checks := checks + 1;
    begin perform public.set_my_goal('ficar_rico'); raise exception 'invalid goal accepted'; exception when invalid_parameter_value then checks := checks + 1; end;
    -- Conta sem celular (Google) passa a ter; formato normalizado; troca zera verificação.
    select phone into t from public.set_my_phone('(21) 99876-5432'); if t <> '+5521998765432' then raise exception 'phone not saved %', t; end if; checks := checks + 1;
    begin perform public.set_my_phone('123'); raise exception 'invalid phone accepted'; exception when invalid_parameter_value then checks := checks + 1; end;
    -- Não lê objetivo nem celular de outra pessoa.
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    select count(*) into n from public.account_goals; if n <> 0 then raise exception 'reads other goal'; end if; checks := checks + 1;
    reset role;
    update public.account_contacts set phone_verified_at = now() where user_id = b;
    set local role authenticated;
    perform public.set_my_phone('11 91234-5678');
    if (select phone_verified_at from public.account_contacts where user_id = b) is not null then raise exception 'verification kept'; end if; checks := checks + 1;
    -- Sessão anônima não grava.
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    begin perform public.set_my_goal('emagrecer'); raise exception 'anonymous saved goal'; exception when insufficient_privilege then checks := checks + 1; end;
    reset role;
    if checks <> 8 then raise exception 'unexpected check count %', checks; end if;
    raise sqlstate 'W3690' using message = '8 onboarding checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
