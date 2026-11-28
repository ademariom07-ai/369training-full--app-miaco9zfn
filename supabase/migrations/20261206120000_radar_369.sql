-- Radar 369: estudos científicos recentes por especialidade, resumidos em português para os parceiros.
-- Fonte: PubMed (artigos reais, com link). A Edge Function "radar" busca toda semana (segunda, 02:00 UTC = domingo 23:00
-- em Brasília) e a IA resume só o que veio do PubMed (título, resumo do artigo). O nível de evidência vem do tipo de
-- publicação informado pelo PubMed, não da IA. O admin pode ocultar itens e publicar notas dos conselhos à mão.

create table public.radar_items (
 id uuid primary key default gen_random_uuid(),
 specialty text not null check (specialty in ('educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais')),
 pmid text not null check (pmid ~ '^[0-9]{1,10}$'),
 title_original text not null check (char_length(title_original) between 3 and 600),
 title_pt text not null check (char_length(title_pt) between 3 and 300),
 journal text check (journal is null or char_length(journal) <= 300),
 pub_year integer check (pub_year is null or pub_year between 1990 and 2100),
 evidence text not null check (evidence in ('metanalise','revisao_sistematica','ensaio_clinico','diretriz','revisao','estudo')),
 summary_pt text not null check (char_length(summary_pt) between 10 and 900),
 practice_pt text check (practice_pt is null or char_length(practice_pt) <= 500),
 content_idea_pt text check (content_idea_pt is null or char_length(content_idea_pt) <= 300),
 week text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 unique (specialty, pmid)
);
create index radar_items_list on public.radar_items(specialty, created_at desc);
create table public.radar_notes (
 id uuid primary key default gen_random_uuid(),
 specialty text not null check (specialty in ('todas','educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais')),
 title text not null check (char_length(title) between 3 and 150),
 body text not null check (char_length(body) between 3 and 1500),
 url text check (url is null or (url ~ '^https://' and char_length(url) <= 500)),
 author_id uuid references public.profiles(id) on delete set null,
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.radar_items enable row level security;
alter table public.radar_notes enable row level security;
revoke all on public.radar_items, public.radar_notes from public, anon, authenticated;
grant select, insert, update, delete on public.radar_items, public.radar_notes to service_role;

-- Quem vê o Radar: parceiros aprovados e admin.
create or replace function wellness_private.radar_viewer() returns text
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); r text;
begin
 select case when p.role = 'admin' then 'admin' when p.role = 'profissional' and p.approved then 'profissional' end into r from public.profiles p where p.id = actor;
 if r is null then raise exception using errcode = '42501', message = 'O Radar 369 é para parceiros.'; end if;
 return r;
end $fn$;
revoke all on function wellness_private.radar_viewer() from public, anon, authenticated;

-- Área padrão do parceiro (para abrir o Radar já filtrado).
create or replace function wellness_private.radar_my_specialty() returns text
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 perform wellness_private.radar_viewer();
 return (select a.specialty from public.professional_applications a where a.applicant_id = actor and a.status = 'approved');
end $fn$;

-- Lista estudos e notas (as mais recentes primeiro). p_specialty null = todas.
create or replace function wellness_private.list_radar(p_specialty text, p_page integer)
 returns table (item_id uuid, kind text, specialty text, title text, title_original text, journal text, pub_year integer, evidence text,
  summary text, practice text, content_idea text, url text, week text, hidden boolean, created_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare who text := wellness_private.radar_viewer();
begin
 if (p_specialty is not null and p_specialty not in ('educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais')) or coalesce(p_page, 0) not between 1 and 50 then
  raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 return query select * from (
  select i.id, 'estudo'::text, i.specialty, i.title_pt, i.title_original, i.journal, i.pub_year, i.evidence, i.summary_pt, i.practice_pt, i.content_idea_pt,
   'https://pubmed.ncbi.nlm.nih.gov/' || i.pmid || '/', i.week, i.hidden, i.created_at
  from public.radar_items i where (p_specialty is null or i.specialty = p_specialty) and (not i.hidden or who = 'admin')
  union all
  select n.id, 'nota'::text, n.specialty, n.title, null, null, null, null, n.body, null, null, n.url, null, n.hidden, n.created_at
  from public.radar_notes n where (p_specialty is null or n.specialty in ('todas', p_specialty)) and (not n.hidden or who = 'admin')
 ) x order by x.created_at desc limit 30 offset (p_page - 1) * 30;
end $fn$;

create or replace function wellness_private.admin_hide_radar(p_id uuid, p_hide boolean) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin();
begin
 update public.radar_items set hidden = p_hide where id = p_id;
 if not found then update public.radar_notes set hidden = p_hide where id = p_id; end if;
 if not found then raise exception using errcode = '42501', message = 'Item indisponível.'; end if;
end $fn$;
create or replace function wellness_private.admin_save_radar_note(p_specialty text, p_title text, p_body text, p_url text) returns uuid
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_admin(); result uuid; v_url text := nullif(btrim(coalesce(p_url,'')), '');
begin
 if p_specialty not in ('todas','educacao_fisica','nutricao','fisioterapia','psicologia','artes_marciais') or char_length(btrim(coalesce(p_title,''))) not between 3 and 150
  or char_length(btrim(coalesce(p_body,''))) not between 3 and 1500 or (v_url is not null and (v_url !~ '^https://' or char_length(v_url) > 500)) then
  raise exception using errcode = '22023', message = 'Nota inválida: confira título, texto e link (https://).'; end if;
 insert into public.radar_notes (specialty, title, body, url, author_id) values (p_specialty, btrim(p_title), btrim(p_body), v_url, actor) returning id into result;
 return result;
end $fn$;

create or replace function public.radar_my_specialty() returns text language sql stable security invoker set search_path = '' as $$select wellness_private.radar_my_specialty()$$;
create or replace function public.list_radar(p_specialty text, p_page integer)
 returns table (item_id uuid, kind text, specialty text, title text, title_original text, journal text, pub_year integer, evidence text,
  summary text, practice text, content_idea text, url text, week text, hidden boolean, created_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_radar(p_specialty, p_page)$$;
create or replace function public.admin_hide_radar(p_id uuid, p_hide boolean) returns void language sql security invoker set search_path = '' as $$select wellness_private.admin_hide_radar(p_id, p_hide)$$;
create or replace function public.admin_save_radar_note(p_specialty text, p_title text, p_body text, p_url text) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.admin_save_radar_note(p_specialty, p_title, p_body, p_url)$$;
revoke all on function wellness_private.radar_my_specialty(), public.radar_my_specialty(), wellness_private.list_radar(text,integer), public.list_radar(text,integer),
 wellness_private.admin_hide_radar(uuid,boolean), public.admin_hide_radar(uuid,boolean), wellness_private.admin_save_radar_note(text,text,text,text), public.admin_save_radar_note(text,text,text,text)
 from public, anon, authenticated;
grant execute on function wellness_private.radar_my_specialty(), public.radar_my_specialty(), wellness_private.list_radar(text,integer), public.list_radar(text,integer),
 wellness_private.admin_hide_radar(uuid,boolean), public.admin_hide_radar(uuid,boolean), wellness_private.admin_save_radar_note(text,text,text,text), public.admin_save_radar_note(text,text,text,text)
 to authenticated;

-- Funções da Edge Function "radar" (só service_role).
create or replace function public.radar_worker_known(p_specialty text) returns table (pmid text)
 language sql stable security definer set search_path = '' as $fn$ select i.pmid from public.radar_items i where i.specialty = p_specialty $fn$;
-- Grava os itens (jsonb array). Ignora repetidos. Retorna quantos entraram.
create or replace function public.radar_worker_save(p_items jsonb) returns integer
 language plpgsql security definer set search_path = '' as $fn$
declare it jsonb; n integer := 0; wk text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'IYYY-"W"IW');
begin
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60 then raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 for it in select * from jsonb_array_elements(p_items) loop
  begin
   insert into public.radar_items (specialty, pmid, title_original, title_pt, journal, pub_year, evidence, summary_pt, practice_pt, content_idea_pt, week)
    values (it->>'specialty', it->>'pmid', left(it->>'title_original', 600), left(it->>'title_pt', 300), left(it->>'journal', 300), nullif(it->>'pub_year','')::int,
     it->>'evidence', left(it->>'summary_pt', 900), left(nullif(it->>'practice_pt',''), 500), left(nullif(it->>'content_idea_pt',''), 300), wk)
    on conflict (specialty, pmid) do nothing;
   if found then n := n + 1; end if;
  exception when check_violation or not_null_violation or invalid_text_representation then null;
  end;
 end loop;
 return n;
end $fn$;
-- Quem pode pedir "atualizar agora" (admin logado).
create or replace function public.radar_worker_is_admin(p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$ select exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') $fn$;
revoke all on function public.radar_worker_known(text), public.radar_worker_save(jsonb), public.radar_worker_is_admin(uuid) from public, anon, authenticated;
grant execute on function public.radar_worker_known(text), public.radar_worker_save(jsonb), public.radar_worker_is_admin(uuid) to service_role;

-- Agenda semanal (só no Supabase): segunda 02:00 UTC (domingo 23:00 em Brasília).
do $sched$
begin
 if exists (select 1 from pg_extension where extname = 'pg_net') and exists (select 1 from pg_namespace where nspname = 'cron') then
  perform cron.schedule('wellness-radar-weekly', '0 2 * * 1', $cmd$select net.http_post(
    url := 'https://elahjmtboqhqqxmoaths.supabase.co/functions/v1/radar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select value from wellness_private.app_settings where key = 'push_cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)$cmd$);
 end if;
end $sched$;

notify pgrst, 'reload schema';
