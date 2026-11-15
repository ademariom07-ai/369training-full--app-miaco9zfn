-- Cadastro rápido: perfil e telefone criados a partir do signUp; isolamento do telefone.
-- Todas as contas e linhas de teste são desfeitas no bloco de exceção. Sem e-mails ou envios reais.
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid(); n integer; checks integer := 0;
begin
  begin
    -- Conta com nome e celular válidos (formato digitado pela pessoa).
    insert into auth.users(id, raw_user_meta_data) values
      (a, jsonb_build_object('full_name', '  Maria   da Silva ', 'phone', '(11) 98765-4321', 'role', 'admin', 'approved', true));
    if (select display_name from public.profiles where id = a) <> 'Maria da Silva' then raise exception 'name not normalized'; end if; checks := checks + 1;
    if (select role from public.profiles where id = a) <> 'aluno' or (select approved from public.profiles where id = a) then raise exception 'metadata escalated role'; end if; checks := checks + 1;
    if (select phone from public.account_contacts where user_id = a) <> '+5511987654321' then raise exception 'phone not normalized'; end if; checks := checks + 1;
    if (select phone_verified_at from public.account_contacts where user_id = a) is not null then raise exception 'phone born verified'; end if; checks := checks + 1;

    -- Telefone fixo com DDI e conta sem telefone.
    insert into auth.users(id, raw_user_meta_data) values (b, jsonb_build_object('full_name', 'João Souza', 'phone', '+55 21 3333-4444'));
    if (select phone from public.account_contacts where user_id = b) <> '+552133334444' then raise exception 'landline not accepted'; end if; checks := checks + 1;
    insert into auth.users(id, raw_user_meta_data) values (c, jsonb_build_object('full_name', 'Sem Telefone'));
    if exists(select 1 from public.account_contacts where user_id = c) then raise exception 'empty phone stored'; end if; checks := checks + 1;

    -- Dados inválidos não quebram o cadastro: sem perfil (pede nome depois) e sem telefone.
    insert into auth.users(id, raw_user_meta_data) values (d, jsonb_build_object('full_name', repeat('x', 200), 'phone', '12345'));
    if exists(select 1 from public.profiles where id = d) then raise exception 'oversized name stored'; end if; checks := checks + 1;
    if exists(select 1 from public.account_contacts where user_id = d) then raise exception 'invalid phone stored'; end if; checks := checks + 1;
    if wellness_private.normalize_signup_phone('(11) 8765-4321') is not null then raise exception 'mobile without 9 accepted'; end if; checks := checks + 1;
    if wellness_private.normalize_signup_phone('11 98765-4321; drop table x') is not null then raise exception 'garbage accepted'; end if; checks := checks + 1;

    -- Titular lê e troca o próprio telefone; a verificação é zerada na troca.
    update public.account_contacts set phone_verified_at = now() where user_id = a;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false)::text, true);
    set local role authenticated;
    select count(*) into n from public.account_contacts; if n <> 1 then raise exception 'sees other phones'; end if; checks := checks + 1;
    update public.account_contacts set phone = '+5511912345678' where user_id = a;
    if (select phone_verified_at from public.account_contacts where user_id = a) is not null then raise exception 'verification kept after change'; end if; checks := checks + 1;
    begin update public.account_contacts set phone = 'abc' where user_id = a; raise exception 'invalid phone update allowed'; exception when check_violation then checks := checks + 1; end;
    begin update public.account_contacts set phone_verified_at = now() where user_id = a; raise exception 'self verification allowed'; exception when insufficient_privilege then checks := checks + 1; end;
    update public.account_contacts set phone = '+5511900000000' where user_id = b;
    get diagnostics n = row_count; if n <> 0 then raise exception 'other phone updated'; end if; checks := checks + 1;
    begin insert into public.account_contacts(user_id, phone) values (c, '+5511911112222'); raise exception 'client insert allowed'; exception when insufficient_privilege then checks := checks + 1; end;
    begin delete from public.account_contacts where user_id = a; raise exception 'client delete allowed'; exception when insufficient_privilege then checks := checks + 1; end;

    -- Sessão anônima não lê telefones.
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', true)::text, true);
    select count(*) into n from public.account_contacts; if n <> 0 then raise exception 'anonymous reads phone'; end if; checks := checks + 1;

    reset role;
    if checks<>18 then raise exception 'unexpected check count %',checks; end if;
    raise sqlstate 'W3690' using message='18 quick signup checks passed; rolling back fixtures';
  exception when sqlstate 'W3690' then null;
  end;
end
$test$;
