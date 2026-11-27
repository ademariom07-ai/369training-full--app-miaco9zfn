-- Verificação de identidade em duas etapas.
-- Etapa 1 (cadastro): simples, como já é (nome, celular, e-mail, senha; parceiro informa área e registro).
-- Etapa 2:
--  * Aluno (e parceiro): CPF válido em "Meu perfil". Se nenhum outro já usa o CPF, fica VERIFICADO na hora.
--    Se outra conta já usa, aparece o aviso; a pessoa pode pedir análise e o admin decide.
--    Privacidade (LGPD, minimização): o CPF não é guardado por inteiro — só um código (hash com segredo) para comparar
--    e os 2 últimos dígitos para exibir (***.***.***-12).
--  * Parceiro, para ATENDER: CPF verificado + 3 fotos (documento com foto, selfie segurando o documento,
--    selfie segurando a carteira/certificado do conselho). Ficam num espaço privado; só o próprio parceiro e o admin
--    veem; são APAGADAS depois da análise (o admin confere também no site do conselho).
--    Enquanto não estiver verificado, o parceiro não aceita novos alunos (ajustável em wellness_private.app_settings).

create table if not exists wellness_private.app_settings (key text primary key, value text not null);
alter table wellness_private.app_settings enable row level security;
revoke all on wellness_private.app_settings from public, anon, authenticated;
insert into wellness_private.app_settings (key, value) values
 ('cpf_pepper', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
 ('exigir_verificacao_parceiro', 'true')
 on conflict (key) do nothing;

create table public.account_identity (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 cpf_hash text not null check (cpf_hash ~ '^[0-9a-f]{64}$'),
 cpf_last2 text not null check (cpf_last2 ~ '^[0-9]{2}$'),
 status text not null check (status in ('verificado','em_analise','recusado')),
 duplicate_of uuid references public.profiles(id) on delete set null,
 review_reason text check (review_reason is null or char_length(review_reason) between 3 and 300),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index account_identity_hash on public.account_identity(cpf_hash);
create table public.partner_verifications (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 status text not null check (status in ('em_analise','verificado','recusado')),
 doc_path text, selfie_path text, credential_path text,
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewer_id uuid references public.profiles(id) on delete set null,
 review_reason text check (review_reason is null or char_length(review_reason) between 3 and 300)
);
alter table public.account_identity enable row level security;
alter table public.partner_verifications enable row level security;
revoke all on public.account_identity, public.partner_verifications from public, anon, authenticated;
grant select, insert, update, delete on public.account_identity, public.partner_verifications to service_role;

-- CPF: só dígitos, 11, não repetido (111...), dígitos verificadores corretos.
create or replace function wellness_private.cpf_valid(p_cpf text) returns boolean
 language plpgsql immutable set search_path = '' as $fn$
declare d text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'); s int; r int; i int;
begin
 if char_length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
 s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
 r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> substr(d, 10, 1)::int then return false; end if;
 s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
 r := (s * 10) % 11; if r = 10 then r := 0; end if;
 return r = substr(d, 11, 1)::int;
end $fn$;
create or replace function wellness_private.cpf_hash(p_cpf text) returns text
 language sql stable security definer set search_path = '' as $fn$
 select encode(sha256(convert_to((select value from wellness_private.app_settings where key = 'cpf_pepper') || regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'), 'UTF8')), 'hex')
$fn$;
create or replace function wellness_private.partner_verified(p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.partner_verifications v where v.user_id = p_user and v.status = 'verificado')
$fn$;
revoke all on function wellness_private.cpf_valid(text), wellness_private.cpf_hash(text), wellness_private.partner_verified(uuid) from public, anon, authenticated;

-- Informa o CPF. p_request_review = true quando a pessoa aceita mandar para análise um CPF que já está em outra conta.
-- Retorna o status: 'verificado' ou 'em_analise'.
create or replace function wellness_private.set_my_cpf(p_cpf text, p_request_review boolean) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); cur public.account_identity; h text; other uuid; d text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
begin
 if not wellness_private.cpf_valid(d) then raise exception using errcode = '22023', message = 'CPF inválido. Confira os números.'; end if;
 h := wellness_private.cpf_hash(d);
 select * into cur from public.account_identity where user_id = actor for update;
 if found and cur.status = 'verificado' then
  if cur.cpf_hash = h then return 'verificado'; end if;
  raise exception using errcode = '42501', message = 'Seu CPF já foi confirmado. Para corrigir, fale com a equipe 369.';
 end if;
 if found and cur.status = 'em_analise' and cur.cpf_hash = h then return 'em_analise'; end if;
 select a.user_id into other from public.account_identity a where a.cpf_hash = h and a.user_id <> actor and a.status in ('verificado','em_analise') order by (a.status = 'verificado') desc limit 1;
 if other is not null and not coalesce(p_request_review, false) then
  raise exception using errcode = '23505', message = 'Este CPF já está cadastrado em outra conta. Se ele é seu, você pode pedir a análise da equipe 369.'; end if;
 insert into public.account_identity (user_id, cpf_hash, cpf_last2, status, duplicate_of)
  values (actor, h, right(d, 2), case when other is null then 'verificado' else 'em_analise' end, other)
  on conflict (user_id) do update set cpf_hash = excluded.cpf_hash, cpf_last2 = excluded.cpf_last2, status = excluded.status, duplicate_of = excluded.duplicate_of,
   review_reason = null, created_at = now(), reviewed_at = null;
 return case when other is null then 'verificado' else 'em_analise' end;
end $fn$;

-- Situação da verificação da própria conta.
create or replace function wellness_private.my_verification()
 returns table (cpf_status text, cpf_masked text, cpf_reason text, partner_status text, partner_reason text, partner_required boolean,
  doc_sent boolean, selfie_sent boolean, credential_sent boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query select i.status, case when i.cpf_last2 is null then null else '***.***.***-' || i.cpf_last2 end, i.review_reason,
  v.status, v.review_reason, coalesce((select s.value from wellness_private.app_settings s where s.key = 'exigir_verificacao_parceiro'), 'true') = 'true',
  v.doc_path is not null, v.selfie_path is not null, v.credential_path is not null
 from (select actor as id) me left join public.account_identity i on i.user_id = me.id left join public.partner_verifications v on v.user_id = me.id;
end $fn$;

-- Parceiro envia as fotos (caminhos no Storage, pasta própria). Exige CPF verificado.
create or replace function wellness_private.submit_partner_verification(p_doc text, p_selfie text, p_credential text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); pattern text;
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'profissional' and p.approved) then
  raise exception using errcode = '42501', message = 'A verificação é para parceiros já aprovados na primeira etapa.'; end if;
 if not exists (select 1 from public.account_identity i where i.user_id = actor and i.status = 'verificado') then
  raise exception using errcode = '42501', message = 'Primeiro confirme seu CPF em "Meu perfil".'; end if;
 pattern := '^' || actor::text || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp|pdf)$';
 if coalesce(p_doc,'') !~ pattern or coalesce(p_selfie,'') !~ pattern or coalesce(p_credential,'') !~ pattern then
  raise exception using errcode = '22023', message = 'Envie as três fotos.'; end if;
 if exists (select 1 from public.partner_verifications v where v.user_id = actor and v.status = 'verificado') then
  raise exception using errcode = '23505', message = 'Sua verificação já foi aprovada.'; end if;
 insert into public.partner_verifications (user_id, status, doc_path, selfie_path, credential_path) values (actor, 'em_analise', p_doc, p_selfie, p_credential)
  on conflict (user_id) do update set status = 'em_analise', doc_path = excluded.doc_path, selfie_path = excluded.selfie_path, credential_path = excluded.credential_path,
   submitted_at = now(), reviewed_at = null, reviewer_id = null, review_reason = null;
end $fn$;

-- Admin: CPFs repetidos em análise.
create or replace function wellness_private.admin_list_cpf_reviews()
 returns table (user_id uuid, display_name text, email text, role text, cpf_masked text, created_at timestamptz, other_id uuid, other_name text, other_email text, other_status text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin();
begin
 return query select i.user_id, p.display_name, to_jsonb(u)->>'email', p.role, '***.***.***-' || i.cpf_last2, i.created_at,
  o.user_id, op.display_name, to_jsonb(ou)->>'email', o.status
 from public.account_identity i join public.profiles p on p.id = i.user_id left join auth.users u on u.id = i.user_id
  left join public.account_identity o on o.user_id = i.duplicate_of left join public.profiles op on op.id = o.user_id left join auth.users ou on ou.id = o.user_id
 where i.status = 'em_analise' order by i.created_at limit 100;
end $fn$;
create or replace function wellness_private.admin_review_cpf(p_user uuid, p_approve boolean, p_reason text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,''));
begin
 if char_length(v_reason) not between 3 and 300 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 300 caracteres).'; end if;
 update public.account_identity set status = case when p_approve then 'verificado' else 'recusado' end, review_reason = v_reason, reviewed_at = now()
  where user_id = p_user and status = 'em_analise';
 if not found then raise exception using errcode = '42501', message = 'Análise indisponível.'; end if;
end $fn$;

-- Admin: verificações de parceiros em análise.
create or replace function wellness_private.admin_list_partner_verifications()
 returns table (user_id uuid, display_name text, email text, specialty text, credential text, cpf_masked text, cpf_status text,
  doc_path text, selfie_path text, credential_path text, submitted_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin();
begin
 return query select v.user_id, p.display_name, to_jsonb(u)->>'email', a.specialty, a.credential, '***.***.***-' || i.cpf_last2, i.status,
  v.doc_path, v.selfie_path, v.credential_path, v.submitted_at
 from public.partner_verifications v join public.profiles p on p.id = v.user_id left join auth.users u on u.id = v.user_id
  left join public.professional_applications a on a.applicant_id = v.user_id left join public.account_identity i on i.user_id = v.user_id
 where v.status = 'em_analise' order by v.submitted_at limit 100;
end $fn$;
-- Decide e apaga os caminhos das fotos (o app apaga os arquivos no Storage logo antes).
create or replace function wellness_private.admin_review_partner(p_user uuid, p_approve boolean, p_reason text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); v_reason text := btrim(coalesce(p_reason,''));
begin
 if char_length(v_reason) not between 3 and 300 then raise exception using errcode = '22023', message = 'Informe o motivo (3 a 300 caracteres).'; end if;
 update public.partner_verifications set status = case when p_approve then 'verificado' else 'recusado' end, review_reason = v_reason, reviewed_at = now(), reviewer_id = actor,
  doc_path = null, selfie_path = null, credential_path = null
  where user_id = p_user and status = 'em_analise';
 if not found then raise exception using errcode = '42501', message = 'Análise indisponível.'; end if;
end $fn$;
-- Quais destes parceiros estão verificados (selo na busca e na vitrine).
create or replace function wellness_private.verified_partners(p_users uuid[]) returns table (user_id uuid)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if coalesce(array_length(p_users, 1), 0) > 60 then raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 return query select v.user_id from public.partner_verifications v where v.user_id = any(p_users) and v.status = 'verificado';
end $fn$;

-- Trava: parceiro não verificado não aceita novos alunos (quando exigir_verificacao_parceiro = 'true').
create or replace function wellness_private.require_partner_verification() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
begin
 if new.state = 'active' and old.state = 'pending'
  and coalesce((select s.value from wellness_private.app_settings s where s.key = 'exigir_verificacao_parceiro'), 'true') = 'true'
  and not wellness_private.partner_verified(new.professional_id) then
  raise exception using errcode = '42501', message = 'Para aceitar alunos, conclua a verificação de identidade (Meu cadastro profissional › Etapa 2).';
 end if;
 return new;
end $fn$;
revoke all on function wellness_private.require_partner_verification() from public, anon, authenticated;
drop trigger if exists student_links_require_partner_verification on public.student_professional_links;
create trigger student_links_require_partner_verification before update on public.student_professional_links
 for each row execute function wellness_private.require_partner_verification();

create or replace function public.set_my_cpf(p_cpf text, p_request_review boolean) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.set_my_cpf(p_cpf, p_request_review)$$;
create or replace function public.my_verification()
 returns table (cpf_status text, cpf_masked text, cpf_reason text, partner_status text, partner_reason text, partner_required boolean, doc_sent boolean, selfie_sent boolean, credential_sent boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.my_verification()$$;
create or replace function public.submit_partner_verification(p_doc text, p_selfie text, p_credential text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.submit_partner_verification(p_doc, p_selfie, p_credential)$$;
create or replace function public.admin_list_cpf_reviews()
 returns table (user_id uuid, display_name text, email text, role text, cpf_masked text, created_at timestamptz, other_id uuid, other_name text, other_email text, other_status text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.admin_list_cpf_reviews()$$;
create or replace function public.admin_review_cpf(p_user uuid, p_approve boolean, p_reason text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.admin_review_cpf(p_user, p_approve, p_reason)$$;
create or replace function public.admin_list_partner_verifications()
 returns table (user_id uuid, display_name text, email text, specialty text, credential text, cpf_masked text, cpf_status text, doc_path text, selfie_path text, credential_path text, submitted_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.admin_list_partner_verifications()$$;
create or replace function public.admin_review_partner(p_user uuid, p_approve boolean, p_reason text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.admin_review_partner(p_user, p_approve, p_reason)$$;
create or replace function public.verified_partners(p_users uuid[]) returns table (user_id uuid)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.verified_partners(p_users)$$;

revoke all on function
 wellness_private.set_my_cpf(text,boolean), public.set_my_cpf(text,boolean), wellness_private.my_verification(), public.my_verification(),
 wellness_private.submit_partner_verification(text,text,text), public.submit_partner_verification(text,text,text),
 wellness_private.admin_list_cpf_reviews(), public.admin_list_cpf_reviews(), wellness_private.admin_review_cpf(uuid,boolean,text), public.admin_review_cpf(uuid,boolean,text),
 wellness_private.admin_list_partner_verifications(), public.admin_list_partner_verifications(), wellness_private.admin_review_partner(uuid,boolean,text), public.admin_review_partner(uuid,boolean,text),
 wellness_private.verified_partners(uuid[]), public.verified_partners(uuid[])
 from public, anon, authenticated;
grant execute on function
 wellness_private.set_my_cpf(text,boolean), public.set_my_cpf(text,boolean), wellness_private.my_verification(), public.my_verification(),
 wellness_private.submit_partner_verification(text,text,text), public.submit_partner_verification(text,text,text),
 wellness_private.admin_list_cpf_reviews(), public.admin_list_cpf_reviews(), wellness_private.admin_review_cpf(uuid,boolean,text), public.admin_review_cpf(uuid,boolean,text),
 wellness_private.admin_list_partner_verifications(), public.admin_list_partner_verifications(), wellness_private.admin_review_partner(uuid,boolean,text), public.admin_review_partner(uuid,boolean,text),
 wellness_private.verified_partners(uuid[]), public.verified_partners(uuid[])
 to authenticated;

-- Espaço privado das fotos de verificação (só no Supabase). Até 10 MB, imagens ou PDF.
create or replace function wellness_private.is_admin_user() returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$fn$;
revoke all on function wellness_private.is_admin_user() from public, anon, authenticated;
grant execute on function wellness_private.is_admin_user() to authenticated;
do $storage$
begin
 if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('verificacao', 'verificacao', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
   on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy "verificacao: parceiro envia na própria pasta" on storage.objects for insert to authenticated
   with check (bucket_id = 'verificacao' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "verificacao: dono ou admin abre" on storage.objects for select to authenticated
   using (bucket_id = 'verificacao' and ((storage.foldername(name))[1] = auth.uid()::text or wellness_private.is_admin_user()))$p$;
  execute $p$create policy "verificacao: dono ou admin apaga" on storage.objects for delete to authenticated
   using (bucket_id = 'verificacao' and ((storage.foldername(name))[1] = auth.uid()::text or wellness_private.is_admin_user()))$p$;
 end if;
end $storage$;

-- A exclusão/anonimização de conta passa a apagar também o CPF (código) e a verificação.
create or replace function wellness_private.erase_account(p_user uuid) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare outcome text; t text; col text;
begin
 -- Configurações do parceiro (sem valor de histórico).
 if to_regclass('public.professional_availability_days') is not null then delete from public.professional_availability_days where professional_id = p_user; end if;
 if to_regclass('public.professional_booking_terms') is not null then delete from public.professional_booking_terms where professional_id = p_user; end if;
 begin
  delete from auth.users where id = p_user;
  outcome := 'excluida';
 exception when foreign_key_violation then
  outcome := 'anonimizada';
 end;
 if outcome = 'anonimizada' then
  -- Mantém só o que precisa ficar (financeiro/histórico), sem dados pessoais.
  update public.profiles set display_name = 'Conta excluída', approved = false, role = case when role = 'profissional' then 'profissional' else 'aluno' end where id = p_user;
  -- Dados pessoais (cada tabela só se existir no banco).
  for t, col in select * from (values ('account_contacts','user_id'),('account_locations','user_id'),('account_goals','user_id'),('professional_profiles','user_id'),
    ('hydration_days','user_id'),('hydration_settings','user_id'),('challenge_participants','user_id'),('account_identity','user_id'),('partner_verifications','user_id')) v(t, col) loop
   if to_regclass('public.' || t) is not null then execute format('delete from public.%I where %I = $1', t, col) using p_user; end if;
  end loop;
  if to_regclass('public.reviews') is not null then delete from public.reviews where reviewer_id = p_user or reviewee_id = p_user; end if;
  update public.student_professional_links set state = 'revoked', revoked_at = coalesce(revoked_at, now())
   where (student_id = p_user or professional_id = p_user) and state <> 'revoked';
  if to_regclass('public.professional_contents') is not null then update public.professional_contents set status = 'arquivado', updated_at = now() where owner_id = p_user and status <> 'arquivado'; end if;
  if to_regclass('public.challenges') is not null then update public.challenges set status = 'arquivado' where owner_id = p_user and status <> 'arquivado'; end if;
  if to_regclass('public.feed_videos') is not null then update public.feed_videos set status = 'removed' where professional_id = p_user and status in ('pending','approved'); end if;
  -- Bloqueia o login e libera o e-mail (só existe no Supabase; ignorado onde as colunas não existirem).
  begin
   if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    execute 'update auth.users set banned_until = ''infinity'' where id = $1' using p_user;
   end if;
   execute 'update auth.users set email = $2 where id = $1' using p_user, 'excluida-' || p_user::text || '@conta-excluida.invalid';
   if to_regclass('auth.identities') is not null then execute 'delete from auth.identities where user_id = $1' using p_user; end if;
   if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using p_user; end if;
  exception when others then
   outcome := 'anonimizada_sem_bloqueio';
  end;
 end if;
 return outcome;
end $fn$;

notify pgrst, 'reload schema';
