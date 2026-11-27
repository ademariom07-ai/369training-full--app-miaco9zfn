-- Notificações push (aparecem no celular/computador mesmo com o app fechado).
-- * push_subscriptions: aparelhos de cada pessoa (endereço do serviço de push do navegador + chaves públicas dele).
-- * push_prefs: o que cada pessoa quer receber (mensagens, treinos, conteúdos, vínculos/verificação, água, lembrete de treino).
-- * push_queue: fila. Gatilhos colocam avisos na fila; a Edge Function "push" envia a cada minuto (pg_cron + pg_net).
-- * As chaves VAPID (de quem envia) são criadas pela própria função na primeira vez e guardadas em app_settings.
-- Privacidade: o aviso de mensagem diz só quem mandou, não o texto.

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
 p256dh text not null check (char_length(p256dh) between 40 and 200),
 auth text not null check (char_length(auth) between 10 and 100),
 created_at timestamptz not null default now(),
 last_ok_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
create table public.push_prefs (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 mensagens boolean not null default true,
 treinos boolean not null default true,
 conteudos boolean not null default true,
 vinculos boolean not null default true,
 agua boolean not null default true,
 treino_hora smallint check (treino_hora is null or treino_hora between 5 and 22),
 updated_at timestamptz not null default now()
);
create table public.push_queue (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('mensagem','treino_novo','conteudo','vinculo','verificacao','agua','lembrete_treino','teste')),
 title text not null check (char_length(title) between 1 and 80),
 body text not null check (char_length(body) between 1 and 200),
 url text not null default '/acesso' check (url ~ '^/'),
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 attempts smallint not null default 0
);
create index push_queue_pending on public.push_queue(created_at) where sent_at is null;
create index push_queue_user_kind on public.push_queue(user_id, kind, created_at desc);
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_queue enable row level security;
revoke all on public.push_subscriptions, public.push_prefs, public.push_queue from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions, public.push_prefs, public.push_queue to service_role;

insert into wellness_private.app_settings (key, value) values ('push_cron_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
 on conflict (key) do nothing;

-- Coloca um aviso na fila, se a pessoa tem aparelho cadastrado e quer esse tipo de aviso. Evita repetir o mesmo aviso em 2 minutos.
create or replace function wellness_private.push_enqueue(p_user uuid, p_kind text, p_title text, p_body text, p_url text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare pref public.push_prefs; wanted boolean;
begin
 if p_user is null or not exists (select 1 from public.push_subscriptions s where s.user_id = p_user) then return; end if;
 select * into pref from public.push_prefs where user_id = p_user;
 wanted := case p_kind when 'mensagem' then coalesce(pref.mensagens, true) when 'treino_novo' then coalesce(pref.treinos, true)
  when 'lembrete_treino' then coalesce(pref.treinos, true) when 'conteudo' then coalesce(pref.conteudos, true)
  when 'vinculo' then coalesce(pref.vinculos, true) when 'verificacao' then coalesce(pref.vinculos, true) when 'agua' then coalesce(pref.agua, true) else true end;
 if not wanted then return; end if;
 if exists (select 1 from public.push_queue q where q.user_id = p_user and q.kind = p_kind and q.url = coalesce(p_url,'/acesso') and q.created_at > now() - interval '2 minutes') then return; end if;
 insert into public.push_queue (user_id, kind, title, body, url) values (p_user, p_kind, left(p_title, 80), left(p_body, 200), coalesce(p_url, '/acesso'));
end $fn$;
revoke all on function wellness_private.push_enqueue(uuid,text,text,text,text) from public, anon, authenticated;

-- Gatilhos de eventos ------------------------------------------------------------------------------------------
create or replace function wellness_private.push_on_chat() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare t public.chat_threads; sender text; a uuid;
begin
 select * into t from public.chat_threads where id = new.thread_id;
 select coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Alguém') into sender from public.profiles p where p.id = new.sender_id;
 if t.kind = 'vinculo' then
  perform wellness_private.push_enqueue(case when new.sender_id = t.member_id then t.professional_id else t.member_id end, 'mensagem', 'Nova mensagem', 'Mensagem de ' || sender || '. Toque para ler.', '/acesso#mensagens');
 elsif new.sender_id = t.member_id then
  for a in select p.id from public.profiles p where p.role = 'admin' loop
   perform wellness_private.push_enqueue(a, 'mensagem', 'Suporte: nova mensagem', 'Mensagem de ' || sender || '.', '/acesso#mensagens');
  end loop;
 else
  perform wellness_private.push_enqueue(t.member_id, 'mensagem', 'Equipe 369 WELLNESS', 'Você recebeu uma mensagem da equipe.', '/acesso#mensagens');
 end if;
 return null;
end $fn$;
create or replace function wellness_private.push_on_routine() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
begin
 if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from 'publicado') and new.author_id <> new.student_id then
  perform wellness_private.push_enqueue(new.student_id, 'treino_novo', case when new.kind = 'dieta' then 'Nova dieta para você' else 'Novo treino para você' end,
   left(new.title, 120) || ' — já está no seu app.', '/acesso#treino');
 end if;
 return null;
end $fn$;
create or replace function wellness_private.push_on_content() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare s uuid; owner_name text;
begin
 if new.status <> 'publicado' or new.audience = 'publico' or (tg_op = 'UPDATE' and old.status = 'publicado') then return null; end if;
 select coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Seu profissional') into owner_name from public.profiles p where p.id = new.owner_id;
 for s in select k.student_id from public.student_professional_links k where new.audience = 'meus_alunos' and k.professional_id = new.owner_id and k.state = 'active' loop
  perform wellness_private.push_enqueue(s, 'conteudo', 'Novo conteúdo de ' || owner_name, left(new.title, 150), '/acesso#conteudos');
 end loop;
 return null;
end $fn$;
-- Selecionados: o aviso sai quando os destinatários são gravados.
create or replace function wellness_private.push_on_content_recipient() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare c public.professional_contents; owner_name text;
begin
 select * into c from public.professional_contents where id = new.content_id;
 if c.status <> 'publicado' then return null; end if;
 select coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Seu profissional') into owner_name from public.profiles p where p.id = c.owner_id;
 perform wellness_private.push_enqueue(new.student_id, 'conteudo', 'Novo conteúdo de ' || owner_name, left(c.title, 150), '/acesso#conteudos');
 return null;
end $fn$;
create or replace function wellness_private.push_on_link() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
declare student_name text; pro_name text;
begin
 select coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Um aluno') into student_name from public.profiles p where p.id = new.student_id;
 select coalesce(nullif(split_part(p.display_name, ' ', 1), ''), 'Seu profissional') into pro_name from public.profiles p where p.id = new.professional_id;
 if new.state = 'pending' and (tg_op = 'INSERT' or old.state <> 'pending' or old.professional_id <> new.professional_id) then
  perform wellness_private.push_enqueue(new.professional_id, 'vinculo', 'Novo pedido de aluno', student_name || ' quer ser acompanhado(a) por você.', '/acesso#alunos');
 elsif tg_op = 'UPDATE' and new.state = 'active' and old.state = 'pending' then
  perform wellness_private.push_enqueue(new.student_id, 'vinculo', 'Pedido aceito!', pro_name || ' aceitou acompanhar você.', '/acesso#treino');
 end if;
 return null;
end $fn$;
create or replace function wellness_private.push_on_verification() returns trigger
 language plpgsql security definer set search_path = '' as $fn$
begin
 if tg_op = 'UPDATE' and old.status = 'em_analise' and new.status in ('verificado','recusado') then
  perform wellness_private.push_enqueue(new.user_id, 'verificacao', case when new.status = 'verificado' then 'Verificação aprovada' else 'Verificação não aprovada' end,
   case when new.status = 'verificado' then 'Tudo certo! Confira no app.' else 'Veja o motivo no app e tente de novo.' end,
   case when tg_table_name = 'partner_verifications' then '/acesso#cadastro' else '/acesso#perfil' end);
 end if;
 return null;
end $fn$;
revoke all on function wellness_private.push_on_chat(), wellness_private.push_on_routine(), wellness_private.push_on_content(), wellness_private.push_on_content_recipient(),
 wellness_private.push_on_link(), wellness_private.push_on_verification() from public, anon, authenticated;
create trigger push_chat after insert on public.chat_messages for each row execute function wellness_private.push_on_chat();
create trigger push_routine after insert or update of status on public.routine_plans for each row execute function wellness_private.push_on_routine();
create trigger push_content after insert or update of status on public.professional_contents for each row execute function wellness_private.push_on_content();
create trigger push_content_recipient after insert on public.content_recipients for each row execute function wellness_private.push_on_content_recipient();
create trigger push_link after insert or update on public.student_professional_links for each row execute function wellness_private.push_on_link();
create trigger push_partner_verification after update on public.partner_verifications for each row execute function wellness_private.push_on_verification();
create trigger push_identity after update on public.account_identity for each row execute function wellness_private.push_on_verification();

-- Lembretes programados (chamado a cada minuto pela função "push") --------------------------------------------
create or replace function wellness_private.push_enqueue_reminders() returns integer
 language plpgsql security definer set search_path = '' as $fn$
declare now_sp timestamp := now() at time zone 'America/Sao_Paulo'; today date := (now() at time zone 'America/Sao_Paulo')::date;
 hour int := extract(hour from now() at time zone 'America/Sao_Paulo'); dow text := (array['dom','seg','ter','qua','qui','sex','sab'])[extract(dow from now() at time zone 'America/Sao_Paulo')::int + 1];
 r record; n integer := 0;
begin
 -- Água: quem ligou os lembretes, dentro do horário, abaixo da meta e depois do intervalo escolhido.
 for r in select h.user_id, h.goal_ml, h.every_min, coalesce(d.ml, 0) as ml from public.hydration_settings h
  left join public.hydration_days d on d.user_id = h.user_id and d.day = today
  where h.remind and hour >= h.from_hour and hour < h.to_hour and coalesce(d.ml, 0) < h.goal_ml
   and exists (select 1 from public.push_subscriptions s where s.user_id = h.user_id)
   and not exists (select 1 from public.push_queue q where q.user_id = h.user_id and q.kind = 'agua' and q.created_at > now() - make_interval(mins => h.every_min))
 loop
  perform wellness_private.push_enqueue(r.user_id, 'agua', 'Hora de beber água 💧', 'Hoje: ' || r.ml || ' de ' || r.goal_ml || ' ml.', '/acesso#desafios'); n := n + 1;
 end loop;
 -- Treino: na hora escolhida, se hoje tem treino no plano e ainda não foi registrado.
 for r in select p.user_id from public.push_prefs p where p.treino_hora = hour and p.treinos
  and exists (select 1 from public.routine_plans rp, jsonb_array_elements(rp.structure->'days') d where rp.student_id = p.user_id and rp.kind = 'treino' and rp.status = 'publicado' and d->>'key' = dow)
  and not exists (select 1 from public.routine_sessions s where s.student_id = p.user_id and s.done_on = today)
  and not exists (select 1 from public.push_queue q where q.user_id = p.user_id and q.kind = 'lembrete_treino' and q.created_at > now() - interval '20 hours')
 loop
  perform wellness_private.push_enqueue(r.user_id, 'lembrete_treino', 'Bora treinar? 💪', 'Seu treino de hoje está esperando no app.', '/acesso#treino'); n := n + 1;
 end loop;
 return n;
end $fn$;
revoke all on function wellness_private.push_enqueue_reminders() from public, anon, authenticated;

-- Funções do app (pessoa logada) ------------------------------------------------------------------------------
create or replace function wellness_private.push_public_key() returns text
 language sql stable security definer set search_path = '' as $fn$ select value from wellness_private.app_settings where key = 'vapid_public' $fn$;
create or replace function wellness_private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if coalesce(p_endpoint,'') !~ '^https://' or char_length(p_endpoint) > 1000 or char_length(coalesce(p_p256dh,'')) not between 40 and 200 or char_length(coalesce(p_auth,'')) not between 10 and 100 then
  raise exception using errcode = '22023', message = 'Aparelho inválido.'; end if;
 if (select count(*) from public.push_subscriptions s where s.user_id = actor) >= 10 then
  delete from public.push_subscriptions where id = (select s.id from public.push_subscriptions s where s.user_id = actor order by s.created_at limit 1); end if;
 insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (actor, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
 insert into public.push_prefs (user_id) values (actor) on conflict do nothing;
end $fn$;
create or replace function wellness_private.delete_push_subscription(p_endpoint text) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 delete from public.push_subscriptions where endpoint = p_endpoint and user_id = actor;
end $fn$;
create or replace function wellness_private.my_push_settings()
 returns table (devices integer, mensagens boolean, treinos boolean, conteudos boolean, vinculos boolean, agua boolean, treino_hora smallint)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 return query select (select count(*)::int from public.push_subscriptions s where s.user_id = actor), coalesce(p.mensagens, true), coalesce(p.treinos, true),
  coalesce(p.conteudos, true), coalesce(p.vinculos, true), coalesce(p.agua, true), p.treino_hora
 from (select actor as id) me left join public.push_prefs p on p.user_id = me.id;
end $fn$;
create or replace function wellness_private.save_push_prefs(p_mensagens boolean, p_treinos boolean, p_conteudos boolean, p_vinculos boolean, p_agua boolean, p_treino_hora integer) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if p_treino_hora is not null and p_treino_hora not between 5 and 22 then raise exception using errcode = '22023', message = 'Horário inválido.'; end if;
 insert into public.push_prefs (user_id, mensagens, treinos, conteudos, vinculos, agua, treino_hora)
  values (actor, coalesce(p_mensagens, true), coalesce(p_treinos, true), coalesce(p_conteudos, true), coalesce(p_vinculos, true), coalesce(p_agua, true), p_treino_hora)
  on conflict (user_id) do update set mensagens = excluded.mensagens, treinos = excluded.treinos, conteudos = excluded.conteudos, vinculos = excluded.vinculos,
   agua = excluded.agua, treino_hora = excluded.treino_hora, updated_at = now();
end $fn$;
create or replace function wellness_private.push_test() returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not exists (select 1 from public.push_subscriptions s where s.user_id = actor) then raise exception using errcode = '22023', message = 'Ative as notificações neste aparelho primeiro.'; end if;
 if exists (select 1 from public.push_queue q where q.user_id = actor and q.kind = 'teste' and q.created_at > now() - interval '30 seconds') then return; end if;
 insert into public.push_queue (user_id, kind, title, body, url) values (actor, 'teste', '369 WELLNESS', 'Notificações funcionando! 🎉', '/acesso#perfil');
end $fn$;

create or replace function public.push_public_key() returns text language sql stable security invoker set search_path = '' as $$select wellness_private.push_public_key()$$;
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.save_push_subscription(p_endpoint, p_p256dh, p_auth)$$;
create or replace function public.delete_push_subscription(p_endpoint text) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.delete_push_subscription(p_endpoint)$$;
create or replace function public.my_push_settings() returns table (devices integer, mensagens boolean, treinos boolean, conteudos boolean, vinculos boolean, agua boolean, treino_hora smallint)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.my_push_settings()$$;
create or replace function public.save_push_prefs(p_mensagens boolean, p_treinos boolean, p_conteudos boolean, p_vinculos boolean, p_agua boolean, p_treino_hora integer) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.save_push_prefs(p_mensagens, p_treinos, p_conteudos, p_vinculos, p_agua, p_treino_hora)$$;
create or replace function public.push_test() returns void language sql security invoker set search_path = '' as $$select wellness_private.push_test()$$;
revoke all on function wellness_private.push_public_key(), public.push_public_key(), wellness_private.save_push_subscription(text,text,text), public.save_push_subscription(text,text,text),
 wellness_private.delete_push_subscription(text), public.delete_push_subscription(text), wellness_private.my_push_settings(), public.my_push_settings(),
 wellness_private.save_push_prefs(boolean,boolean,boolean,boolean,boolean,integer), public.save_push_prefs(boolean,boolean,boolean,boolean,boolean,integer),
 wellness_private.push_test(), public.push_test() from public, anon, authenticated;
grant execute on function wellness_private.push_public_key(), public.push_public_key(), wellness_private.save_push_subscription(text,text,text), public.save_push_subscription(text,text,text),
 wellness_private.delete_push_subscription(text), public.delete_push_subscription(text), wellness_private.my_push_settings(), public.my_push_settings(),
 wellness_private.save_push_prefs(boolean,boolean,boolean,boolean,boolean,integer), public.save_push_prefs(boolean,boolean,boolean,boolean,boolean,integer),
 wellness_private.push_test(), public.push_test() to authenticated;

-- Funções da Edge Function "push" (só service_role) -----------------------------------------------------------
create or replace function public.push_worker_config() returns table (cron_token text, vapid_public text, vapid_private text)
 language sql stable security definer set search_path = '' as $fn$
 select (select value from wellness_private.app_settings where key = 'push_cron_token'), (select value from wellness_private.app_settings where key = 'vapid_public'),
  (select value from wellness_private.app_settings where key = 'vapid_private')
$fn$;
create or replace function public.push_worker_set_vapid(p_public text, p_private text) returns void
 language sql security definer set search_path = '' as $fn$
 insert into wellness_private.app_settings (key, value) values ('vapid_public', p_public), ('vapid_private', p_private) on conflict (key) do nothing
$fn$;
create or replace function public.push_worker_batch(p_limit integer)
 returns table (queue_id bigint, subscription_id uuid, endpoint text, p256dh text, auth text, title text, body text, url text, kind text)
 language plpgsql security definer set search_path = '' as $fn$
begin
 perform wellness_private.push_enqueue_reminders();
 -- Avisos sem aparelho ou muito antigos são descartados.
 update public.push_queue q set sent_at = now() where q.sent_at is null and (q.created_at < now() - interval '1 day' or q.attempts >= 3
  or not exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id));
 return query with picked as (
  update public.push_queue q set attempts = q.attempts + 1 where q.id in (select id from public.push_queue where sent_at is null order by created_at limit least(greatest(coalesce(p_limit, 100), 1), 500) for update skip locked)
  returning q.*)
 select p.id, s.id, s.endpoint, s.p256dh, s.auth, p.title, p.body, p.url, p.kind from picked p join public.push_subscriptions s on s.user_id = p.user_id;
end $fn$;
create or replace function public.push_worker_done(p_sent bigint[], p_gone uuid[], p_ok uuid[]) returns void
 language sql security definer set search_path = '' as $fn$
 update public.push_queue set sent_at = now() where id = any(coalesce(p_sent, '{}'));
 delete from public.push_subscriptions where id = any(coalesce(p_gone, '{}'));
 update public.push_subscriptions set last_ok_at = now() where id = any(coalesce(p_ok, '{}'));
$fn$;
revoke all on function public.push_worker_config(), public.push_worker_set_vapid(text,text), public.push_worker_batch(integer), public.push_worker_done(bigint[],uuid[],uuid[])
 from public, anon, authenticated;
grant execute on function public.push_worker_config(), public.push_worker_set_vapid(text,text), public.push_worker_batch(integer), public.push_worker_done(bigint[],uuid[],uuid[]) to service_role;

-- Agenda: a cada minuto chama a Edge Function "push" (só no Supabase, com pg_cron e pg_net).
do $sched$
begin
 if exists (select 1 from pg_available_extensions where name = 'pg_net') and exists (select 1 from pg_namespace where nspname = 'cron') then
  create extension if not exists pg_net;
  perform cron.schedule('wellness-push-sender', '* * * * *', $cmd$select net.http_post(
    url := 'https://elahjmtboqhqqxmoaths.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select value from wellness_private.app_settings where key = 'push_cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 25000)$cmd$);
 end if;
end $sched$;

-- Exclusão/anonimização também apaga os dados de push.
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
    ('hydration_days','user_id'),('hydration_settings','user_id'),('challenge_participants','user_id'),('account_identity','user_id'),('partner_verifications','user_id'),('body_assessments','student_id'),('progress_photos','student_id'),('photo_sharing','student_id'),('push_subscriptions','user_id'),('push_prefs','user_id'),('push_queue','user_id')) v(t, col) loop
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
