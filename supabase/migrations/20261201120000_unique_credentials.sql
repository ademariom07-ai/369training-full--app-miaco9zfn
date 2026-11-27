-- Registro profissional único: o mesmo número de conselho/entidade não pode ser usado por parceiros diferentes.
-- Conselhos reconhecidos (CONFEF/CREF contam como o mesmo; CFP/CRP também): CREF, CRN, CREFITO, CRP, CBJ, CBJJ, CBK.
-- A chave é "CONSELHO:números" (sem zeros à esquerda, sem pontos/traços/UF). Sem conselho reconhecido: "OUTRO:números".
-- Vale para pedidos pendentes e aprovados de OUTRA conta (pedido recusado não bloqueia). O registro precisa ter número.
-- Uma trava no banco (gatilho) vale para todos os caminhos: pedido do usuário, aprovação e "tornar parceiro" do admin.

create or replace function wellness_private.credential_key(p_credential text) returns text
 language plpgsql immutable set search_path = '' as $fn$
declare t text := upper(translate(coalesce(p_credential,''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
 council text; digits text;
begin
 council := case
  when t ~ 'CREFITO' then 'CREFITO'
  when t ~ '(CONFEF|CREF)' then 'CREF'
  when t ~ 'CRN' then 'CRN'
  when t ~ '(CRP|CFP)' then 'CRP'
  when t ~ 'CBJJ' then 'CBJJ'
  when t ~ 'CBJ' then 'CBJ'
  when t ~ 'CBK' then 'CBK'
  else 'OUTRO' end;
 -- Números do registro, sem o número da região do conselho grudado no nome (ex.: "CREF4", "CRN-3", "CREFITO 2/").
 t := regexp_replace(t, '(CREFITO|CONFEF|CREF|CRN|CRP|CFP|CBJJ|CBJ|CBK)\s*[-/]?\s*\d{1,2}\s*(/|-|\s)(?=\D*\d)', '\1 ', 'g');
 digits := ltrim(regexp_replace(t, '\D', '', 'g'), '0');
 if digits = '' then return null; end if;
 return council || ':' || digits;
end $fn$;
revoke all on function wellness_private.credential_key(text) from public, anon, authenticated;

create index if not exists professional_applications_credential_key on public.professional_applications ((wellness_private.credential_key(credential))) where status in ('pending','approved');

create or replace function wellness_private.check_unique_credential() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare k text := wellness_private.credential_key(new.credential);
begin
 if new.status not in ('pending','approved') then return new; end if;
 if tg_op = 'UPDATE' and new.credential is not distinct from old.credential and old.status in ('pending','approved') then return new; end if;
 if k is null then raise exception using errcode = '22023', message = 'Informe o número do registro profissional (ex.: CREF 123456-G/SP).'; end if;
 if exists (select 1 from public.professional_applications a where a.applicant_id <> new.applicant_id and a.status in ('pending','approved')
   and wellness_private.credential_key(a.credential) = k) then
  raise exception using errcode = '23505', message = 'Este registro profissional já está cadastrado em outra conta. Se ele é seu, fale com a equipe 369.';
 end if;
 return new;
end $fn$;
revoke all on function wellness_private.check_unique_credential() from public, anon, authenticated;
drop trigger if exists professional_applications_unique_credential on public.professional_applications;
create trigger professional_applications_unique_credential before insert or update on public.professional_applications
 for each row execute function wellness_private.check_unique_credential();

-- Admin: registros repetidos que já existiam antes desta trava (para conferir).
create or replace function wellness_private.admin_duplicate_credentials()
 returns table (credential_key text, applicant_id uuid, applicant_name text, credential text, status text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin();
begin
 return query with k as (select a.*, wellness_private.credential_key(a.credential) as ck from public.professional_applications a where a.status in ('pending','approved'))
  select k.ck, k.applicant_id, k.applicant_name, k.credential, k.status from k
  where k.ck is not null and k.ck in (select ck from k where ck is not null group by ck having count(*) > 1) order by k.ck, k.requested_at;
end $fn$;
create or replace function public.admin_duplicate_credentials()
 returns table (credential_key text, applicant_id uuid, applicant_name text, credential text, status text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.admin_duplicate_credentials()$$;
revoke all on function wellness_private.admin_duplicate_credentials(), public.admin_duplicate_credentials() from public, anon, authenticated;
grant execute on function wellness_private.admin_duplicate_credentials(), public.admin_duplicate_credentials() to authenticated;

notify pgrst, 'reload schema';
