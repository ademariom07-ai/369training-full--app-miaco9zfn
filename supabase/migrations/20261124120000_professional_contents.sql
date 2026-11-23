-- Conteúdos dos profissionais: aulas, vídeos, dicas, e-books, estudos e materiais, grátis ou pagos.
-- Público:
--  * 'publico'      → todos os alunos (aparece em "Conteúdos"); passa pela análise do admin antes de publicar;
--  * 'meus_alunos'  → só os alunos com vínculo ativo com o autor; publica direto;
--  * 'selecionados' → só os alunos escolhidos (um ou um grupo); publica direto.
-- Pago: o aluno vê título, descrição e preço; o conteúdo (vídeo, texto, arquivo) só abre para quem tem acesso
-- liberado. Enquanto não há pagamento no app, o profissional libera o acesso manualmente (ex.: após receber o PIX).
-- Arquivos (PDF, e-book, planilha, áudio...) ficam no Storage, bucket privado "conteudos", pasta do autor.
-- Grupos de alunos: listas salvas pelo profissional para enviar conteúdos de uma vez.

create table public.professional_contents (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('video','aula','dica','ebook','estudo','material')),
 title text not null check (char_length(title) between 3 and 120),
 description text check (description is null or char_length(description) between 1 and 2000),
 body text check (body is null or char_length(body) between 1 and 8000),
 youtube_id text check (youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 file_path text check (file_path is null or char_length(file_path) between 40 and 200),
 file_name text check (file_name is null or char_length(file_name) between 1 and 120),
 file_size integer check (file_size is null or file_size between 1 and 26214400),
 price_cents integer not null default 0 check (price_cents between 0 and 100000),
 audience text not null check (audience in ('publico','meus_alunos','selecionados')),
 status text not null check (status in ('em_analise','publicado','recusado','arquivado')),
 review_reason text check (review_reason is null or char_length(review_reason) between 3 and 300),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 check (youtube_id is not null or body is not null or file_path is not null)
);
create index professional_contents_owner on public.professional_contents(owner_id, updated_at desc);
create index professional_contents_public on public.professional_contents(status, audience, published_at desc);
create table public.content_recipients (
 content_id uuid not null references public.professional_contents(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 primary key (content_id, student_id)
);
create index content_recipients_student on public.content_recipients(student_id);
create table public.content_grants (
 content_id uuid not null references public.professional_contents(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 granted_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key (content_id, user_id)
);
create table public.student_groups (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 60),
 created_at timestamptz not null default now(),
 unique (owner_id, name)
);
create table public.student_group_members (
 group_id uuid not null references public.student_groups(id) on delete cascade,
 student_id uuid not null references public.profiles(id) on delete cascade,
 primary key (group_id, student_id)
);
alter table public.professional_contents enable row level security;
alter table public.content_recipients enable row level security;
alter table public.content_grants enable row level security;
alter table public.student_groups enable row level security;
alter table public.student_group_members enable row level security;
revoke all on public.professional_contents, public.content_recipients, public.content_grants, public.student_groups, public.student_group_members from public, anon, authenticated;
grant select, insert, update, delete on public.professional_contents, public.content_recipients, public.content_grants, public.student_groups, public.student_group_members to service_role;
comment on table public.professional_contents is 'Conteúdos dos profissionais. Acesso só pelas funções *_content(s).';

-- Quem pode publicar: profissional aprovado ou admin.
create function wellness_private.content_author_kind(p_user uuid) returns text
 language sql stable security definer set search_path = '' as $fn$
 select case when p.role = 'admin' then 'admin' when p.role = 'profissional' and p.approved then 'profissional' end
 from public.profiles p where p.id = p_user
$fn$;
-- Aluno com vínculo ativo com o profissional.
create function wellness_private.is_active_student_of(p_student uuid, p_pro uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.student_professional_links k where k.student_id = p_student and k.professional_id = p_pro and k.state = 'active')
$fn$;
-- O usuário vê este conteúdo (título, descrição, preço)?
create function wellness_private.content_visible(c public.professional_contents, p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select c.owner_id = p_user
  or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
  or (c.status = 'publicado' and (
   c.audience = 'publico'
   or (c.audience = 'meus_alunos' and wellness_private.is_active_student_of(p_user, c.owner_id))
   or (c.audience = 'selecionados' and exists (select 1 from public.content_recipients r where r.content_id = c.id and r.student_id = p_user))))
$fn$;
-- O usuário abre o conteúdo (vídeo, texto, arquivo)?
create function wellness_private.content_unlocked(c public.professional_contents, p_user uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select wellness_private.content_visible(c, p_user) and (
  c.owner_id = p_user or c.price_cents = 0
  or exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
  or exists (select 1 from public.content_grants g where g.content_id = c.id and g.user_id = p_user))
$fn$;
revoke all on function wellness_private.content_author_kind(uuid), wellness_private.is_active_student_of(uuid, uuid),
 wellness_private.content_visible(public.professional_contents, uuid), wellness_private.content_unlocked(public.professional_contents, uuid)
 from public, anon, authenticated;

-- Cria ou edita um conteúdo do próprio autor. Retorna o id.
-- p_recipients: alunos escolhidos (só para 'selecionados'; precisam ter vínculo ativo com o autor, ou qualquer aluno se for o admin).
create function wellness_private.save_content(p_id uuid, p_kind text, p_title text, p_description text, p_body text, p_youtube text,
 p_file_path text, p_file_name text, p_file_size integer, p_price_cents integer, p_audience text, p_recipients uuid[])
 returns uuid language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); author text := wellness_private.content_author_kind(actor);
 v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
 v_desc text := nullif(btrim(coalesce(p_description,'')), ''); v_body text := nullif(btrim(coalesce(p_body,'')), '');
 v_yt text := null; v_status text; cur public.professional_contents; result uuid; r uuid;
begin
 if author is null then raise exception using errcode = '42501', message = 'Conteúdos disponíveis para profissionais aprovados.'; end if;
 if nullif(btrim(coalesce(p_youtube,'')), '') is not null then
  v_yt := case when p_youtube ~ '^[A-Za-z0-9_-]{11}$' then p_youtube else wellness_private.youtube_video_id(p_youtube) end;
  if v_yt is null then raise exception using errcode = '22023', message = 'Use um link do YouTube.'; end if;
 end if;
 if p_kind not in ('video','aula','dica','ebook','estudo','material') or char_length(v_title) not between 3 and 120
  or char_length(coalesce(v_desc,'')) > 2000 or char_length(coalesce(v_body,'')) > 8000
  or coalesce(p_price_cents, -1) not between 0 and 100000 or p_audience not in ('publico','meus_alunos','selecionados')
  or (v_yt is null and v_body is null and p_file_path is null) then
  raise exception using errcode = '22023', message = 'Conteúdo inválido: confira os campos.'; end if;
 if p_file_path is not null and (p_file_path !~ ('^' || actor::text || '/[A-Za-z0-9_-]{8,64}\.[a-z0-9]{2,5}$')
  or char_length(coalesce(p_file_name,'')) not between 1 and 120 or coalesce(p_file_size, 0) not between 1 and 26214400) then
  raise exception using errcode = '22023', message = 'Arquivo inválido.'; end if;
 if p_audience = 'selecionados' then
  if coalesce(array_length(p_recipients, 1), 0) not between 1 and 300 then
   raise exception using errcode = '22023', message = 'Escolha pelo menos um aluno.'; end if;
  foreach r in array p_recipients loop
   if not (wellness_private.is_active_student_of(r, actor) or (author = 'admin' and exists (select 1 from public.profiles p where p.id = r and p.role = 'aluno'))) then
    raise exception using errcode = '42501', message = 'Envie só para alunos com acompanhamento ativo com você.'; end if;
  end loop;
 end if;
 v_status := case when p_audience = 'publico' and author <> 'admin' then 'em_analise' else 'publicado' end;
 if p_id is null then
  if (select count(*) from public.professional_contents c where c.owner_id = actor and c.created_at > now() - interval '1 day') >= 30 then
   raise exception using errcode = '54000', message = 'Limite diário de conteúdos atingido.'; end if;
  insert into public.professional_contents (owner_id, kind, title, description, body, youtube_id, file_path, file_name, file_size, price_cents, audience, status, published_at)
   values (actor, p_kind, v_title, v_desc, v_body, v_yt, p_file_path, case when p_file_path is null then null else btrim(p_file_name) end,
    case when p_file_path is null then null else p_file_size end, p_price_cents, p_audience, v_status, case when v_status = 'publicado' then now() end)
   returning id into result;
 else
  select * into cur from public.professional_contents c where c.id = p_id for update;
  if not found or cur.owner_id <> actor or cur.status = 'arquivado' then raise exception using errcode = '42501', message = 'Conteúdo indisponível.'; end if;
  update public.professional_contents set kind = p_kind, title = v_title, description = v_desc, body = v_body, youtube_id = v_yt,
   file_path = p_file_path, file_name = case when p_file_path is null then null else btrim(p_file_name) end,
   file_size = case when p_file_path is null then null else p_file_size end, price_cents = p_price_cents, audience = p_audience,
   status = v_status, review_reason = null, updated_at = now(),
   published_at = case when v_status = 'publicado' then coalesce(cur.published_at, now()) else null end
   where id = p_id;
  result := p_id;
  delete from public.content_recipients where content_id = p_id;
 end if;
 if p_audience = 'selecionados' then
  insert into public.content_recipients (content_id, student_id) select result, x from unnest(p_recipients) x on conflict do nothing;
 end if;
 return result;
end $fn$;

create function wellness_private.archive_content(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 update public.professional_contents set status = 'arquivado', updated_at = now()
  where id = p_id and status <> 'arquivado' and (owner_id = actor or exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin'));
 if not found then raise exception using errcode = '42501', message = 'Conteúdo indisponível.'; end if;
end $fn$;

-- Admin aprova ou recusa um conteúdo público em análise.
create function wellness_private.review_content(p_id uuid, p_approve boolean, p_reason text) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then raise exception using errcode = '42501', message = 'Acesso indisponível.'; end if;
 if not p_approve and char_length(coalesce(v_reason,'')) not between 3 and 300 then raise exception using errcode = '22023', message = 'Informe o motivo da recusa.'; end if;
 update public.professional_contents set status = case when p_approve then 'publicado' else 'recusado' end, review_reason = v_reason,
  published_at = case when p_approve then now() else null end, updated_at = now()
  where id = p_id and status = 'em_analise';
 if not found then raise exception using errcode = '42501', message = 'Conteúdo indisponível.'; end if;
 return case when p_approve then 'publicado' else 'recusado' end;
end $fn$;

-- Autor libera (ou retira) o acesso de um aluno a um conteúdo pago. Só para alunos que veem o conteúdo.
create function wellness_private.grant_content(p_id uuid, p_user uuid, p_grant boolean) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); c public.professional_contents;
begin
 select * into c from public.professional_contents x where x.id = p_id;
 if not found or c.owner_id <> actor or c.status <> 'publicado' then raise exception using errcode = '42501', message = 'Conteúdo indisponível.'; end if;
 if p_grant then
  if not exists (select 1 from public.profiles p where p.id = p_user and p.role = 'aluno') or not wellness_private.content_visible(c, p_user) then
   raise exception using errcode = '42501', message = 'Este aluno não vê este conteúdo.'; end if;
  insert into public.content_grants (content_id, user_id, granted_by) values (p_id, p_user, actor) on conflict do nothing;
 else
  delete from public.content_grants g where g.content_id = p_id and g.user_id = p_user;
 end if;
end $fn$;

-- Lista para quem consome. p_scope: 'para_mim' (do meu profissional / enviados para mim), 'publicos' (vitrine de conteúdos),
-- 'todos' (os dois). Conteúdo bloqueado vem sem vídeo, texto e arquivo.
create function wellness_private.list_contents(p_scope text, p_page integer)
 returns table (content_id uuid, owner_id uuid, owner_name text, kind text, title text, description text, body text, youtube_id text,
  file_path text, file_name text, file_size integer, price_cents integer, audience text, published_at timestamptz, unlocked boolean, for_me boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if p_scope not in ('para_mim','publicos','todos') or coalesce(p_page, 0) not between 1 and 50 then
  raise exception using errcode = '22023', message = 'Dados inválidos.'; end if;
 return query
 with v as (
  select c.*, wellness_private.content_unlocked(c, actor) as ok, (c.audience <> 'publico') as mine
  from public.professional_contents c
  where c.status = 'publicado' and c.owner_id <> actor and wellness_private.content_visible(c, actor)
   and (p_scope = 'todos' or (p_scope = 'para_mim') = (c.audience <> 'publico'))
 )
 select v.id, v.owner_id, case when p.role = 'admin' then 'Equipe 369 WELLNESS' else p.display_name end, v.kind, v.title, v.description,
  case when v.ok then v.body end, case when v.ok then v.youtube_id end, case when v.ok then v.file_path end, v.file_name, v.file_size,
  v.price_cents, v.audience, v.published_at, v.ok, v.mine
 from v join public.profiles p on p.id = v.owner_id
 order by v.published_at desc
 limit 30 offset (p_page - 1) * 30;
end $fn$;

-- Conteúdos do próprio autor, com quantos alunos receberam e quantos têm acesso liberado.
create function wellness_private.list_my_contents()
 returns table (content_id uuid, kind text, title text, description text, body text, youtube_id text, file_path text, file_name text, file_size integer,
  price_cents integer, audience text, status text, review_reason text, updated_at timestamptz, recipients uuid[], grants uuid[])
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query
 select c.id, c.kind, c.title, c.description, c.body, c.youtube_id, c.file_path, c.file_name, c.file_size, c.price_cents, c.audience, c.status, c.review_reason, c.updated_at,
  coalesce((select array_agg(r.student_id) from public.content_recipients r where r.content_id = c.id), '{}'),
  coalesce((select array_agg(g.user_id) from public.content_grants g where g.content_id = c.id), '{}')
 from public.professional_contents c where c.owner_id = actor and c.status <> 'arquivado'
 order by c.updated_at desc limit 100;
end $fn$;

-- Admin: conteúdos públicos aguardando análise.
create function wellness_private.list_pending_contents()
 returns table (content_id uuid, owner_name text, kind text, title text, description text, body text, youtube_id text, file_path text, file_name text, price_cents integer, created_at timestamptz)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'admin') then raise exception using errcode = '42501', message = 'Acesso indisponível.'; end if;
 return query select c.id, p.display_name, c.kind, c.title, c.description, c.body, c.youtube_id, c.file_path, c.file_name, c.price_cents, c.created_at
  from public.professional_contents c join public.profiles p on p.id = c.owner_id where c.status = 'em_analise' order by c.created_at limit 50;
end $fn$;

-- Grupos de alunos do profissional.
create function wellness_private.save_student_group(p_id uuid, p_name text, p_members uuid[]) returns uuid
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_name text := btrim(regexp_replace(coalesce(p_name,''), '\s+', ' ', 'g')); result uuid; r uuid;
begin
 if wellness_private.content_author_kind(actor) is distinct from 'profissional' then raise exception using errcode = '42501', message = 'Grupos disponíveis para profissionais aprovados.'; end if;
 if char_length(v_name) not between 2 and 60 or coalesce(array_length(p_members, 1), 0) not between 1 and 300 then
  raise exception using errcode = '22023', message = 'Dê um nome e escolha pelo menos um aluno.'; end if;
 foreach r in array p_members loop
  if not wellness_private.is_active_student_of(r, actor) then raise exception using errcode = '42501', message = 'Inclua só alunos com acompanhamento ativo com você.'; end if;
 end loop;
 if p_id is null then
  if (select count(*) from public.student_groups g where g.owner_id = actor) >= 50 then raise exception using errcode = '54000', message = 'Limite de grupos atingido.'; end if;
  insert into public.student_groups (owner_id, name) values (actor, v_name) returning id into result;
 else
  update public.student_groups set name = v_name where id = p_id and owner_id = actor returning id into result;
  if result is null then raise exception using errcode = '42501', message = 'Grupo indisponível.'; end if;
  delete from public.student_group_members where group_id = result;
 end if;
 insert into public.student_group_members (group_id, student_id) select result, x from unnest(p_members) x on conflict do nothing;
 return result;
exception when unique_violation then raise exception using errcode = '23505', message = 'Já existe um grupo com esse nome.';
end $fn$;
create function wellness_private.delete_student_group(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 delete from public.student_groups where id = p_id and owner_id = actor;
 if not found then raise exception using errcode = '42501', message = 'Grupo indisponível.'; end if;
end $fn$;
-- Lista os grupos com os membros que ainda têm vínculo ativo.
create function wellness_private.list_student_groups()
 returns table (group_id uuid, name text, members uuid[])
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query select g.id, g.name, coalesce((select array_agg(m.student_id) from public.student_group_members m
   where m.group_id = g.id and wellness_private.is_active_student_of(m.student_id, actor)), '{}')
  from public.student_groups g where g.owner_id = actor order by g.name;
end $fn$;

-- Storage: o arquivo abre para quem tem o conteúdo liberado; o autor envia para a própria pasta.
create function wellness_private.can_open_content_file(p_path text) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.professional_contents c where c.file_path = p_path and c.status <> 'arquivado'
  and wellness_private.content_unlocked(c, auth.uid()))
$fn$;
create function wellness_private.can_upload_content() returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select wellness_private.content_author_kind(auth.uid()) is not null and coalesce(auth.jwt()->>'is_anonymous','false') = 'false'
$fn$;

create function public.save_content(p_id uuid, p_kind text, p_title text, p_description text, p_body text, p_youtube text,
 p_file_path text, p_file_name text, p_file_size integer, p_price_cents integer, p_audience text, p_recipients uuid[]) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_content(p_id, p_kind, p_title, p_description, p_body, p_youtube, p_file_path, p_file_name, p_file_size, p_price_cents, p_audience, p_recipients)$$;
create function public.archive_content(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.archive_content(p_id)$$;
create function public.review_content(p_id uuid, p_approve boolean, p_reason text) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.review_content(p_id, p_approve, p_reason)$$;
create function public.grant_content(p_id uuid, p_user uuid, p_grant boolean) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.grant_content(p_id, p_user, p_grant)$$;
create function public.list_contents(p_scope text, p_page integer)
 returns table (content_id uuid, owner_id uuid, owner_name text, kind text, title text, description text, body text, youtube_id text,
  file_path text, file_name text, file_size integer, price_cents integer, audience text, published_at timestamptz, unlocked boolean, for_me boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_contents(p_scope, p_page)$$;
create function public.list_my_contents()
 returns table (content_id uuid, kind text, title text, description text, body text, youtube_id text, file_path text, file_name text, file_size integer,
  price_cents integer, audience text, status text, review_reason text, updated_at timestamptz, recipients uuid[], grants uuid[])
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_my_contents()$$;
create function public.list_pending_contents()
 returns table (content_id uuid, owner_name text, kind text, title text, description text, body text, youtube_id text, file_path text, file_name text, price_cents integer, created_at timestamptz)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_pending_contents()$$;
create function public.save_student_group(p_id uuid, p_name text, p_members uuid[]) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_student_group(p_id, p_name, p_members)$$;
create function public.delete_student_group(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.delete_student_group(p_id)$$;
create function public.list_student_groups() returns table (group_id uuid, name text, members uuid[])
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_student_groups()$$;

revoke all on function
 wellness_private.save_content(uuid,text,text,text,text,text,text,text,integer,integer,text,uuid[]), public.save_content(uuid,text,text,text,text,text,text,text,integer,integer,text,uuid[]),
 wellness_private.archive_content(uuid), public.archive_content(uuid), wellness_private.review_content(uuid,boolean,text), public.review_content(uuid,boolean,text),
 wellness_private.grant_content(uuid,uuid,boolean), public.grant_content(uuid,uuid,boolean), wellness_private.list_contents(text,integer), public.list_contents(text,integer),
 wellness_private.list_my_contents(), public.list_my_contents(), wellness_private.list_pending_contents(), public.list_pending_contents(),
 wellness_private.save_student_group(uuid,text,uuid[]), public.save_student_group(uuid,text,uuid[]), wellness_private.delete_student_group(uuid), public.delete_student_group(uuid),
 wellness_private.list_student_groups(), public.list_student_groups(), wellness_private.can_open_content_file(text), wellness_private.can_upload_content()
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_content(uuid,text,text,text,text,text,text,text,integer,integer,text,uuid[]), public.save_content(uuid,text,text,text,text,text,text,text,integer,integer,text,uuid[]),
 wellness_private.archive_content(uuid), public.archive_content(uuid), wellness_private.review_content(uuid,boolean,text), public.review_content(uuid,boolean,text),
 wellness_private.grant_content(uuid,uuid,boolean), public.grant_content(uuid,uuid,boolean), wellness_private.list_contents(text,integer), public.list_contents(text,integer),
 wellness_private.list_my_contents(), public.list_my_contents(), wellness_private.list_pending_contents(), public.list_pending_contents(),
 wellness_private.save_student_group(uuid,text,uuid[]), public.save_student_group(uuid,text,uuid[]), wellness_private.delete_student_group(uuid), public.delete_student_group(uuid),
 wellness_private.list_student_groups(), public.list_student_groups(), wellness_private.can_open_content_file(text), wellness_private.can_upload_content()
 to authenticated;

-- Bucket privado e regras de acesso aos arquivos (só existe no Supabase; o banco de teste local não tem Storage).
do $storage$
begin
 if exists (select 1 from pg_namespace where nspname = 'storage') and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('conteudos', 'conteudos', false, 26214400, array['application/pdf','application/epub+zip','image/jpeg','image/png','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','audio/mpeg','audio/mp4','video/mp4'])
   on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy "conteudos: autor envia na própria pasta" on storage.objects for insert to authenticated
   with check (bucket_id = 'conteudos' and (storage.foldername(name))[1] = auth.uid()::text and wellness_private.can_upload_content())$p$;
  execute $p$create policy "conteudos: autor apaga da própria pasta" on storage.objects for delete to authenticated
   using (bucket_id = 'conteudos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "conteudos: abre quem tem acesso" on storage.objects for select to authenticated
   using (bucket_id = 'conteudos' and ((storage.foldername(name))[1] = auth.uid()::text or wellness_private.can_open_content_file(name)))$p$;
 end if;
end $storage$;

notify pgrst, 'reload schema';
