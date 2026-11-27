-- Fase 4: avaliação física e fotos de evolução.
-- Medidas: o próprio aluno ou o profissional com vínculo ativo registra (peso, altura, % de gordura, massa muscular e
-- circunferências). Quem vê: o aluno e o profissional com vínculo ativo. Quem edita: quem registrou.
-- Fotos (frente, lado, costas): só o aluno envia, num espaço privado ("evolucao"). O profissional ativo só vê se o
-- aluno ligar "compartilhar com meu profissional". O aluno apaga quando quiser.

create table public.body_assessments (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 measured_on date not null,
 weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 20 and 350),
 height_cm numeric(4,1) check (height_cm is null or height_cm between 100 and 250),
 body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 70),
 muscle_kg numeric(5,1) check (muscle_kg is null or muscle_kg between 5 and 150),
 waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 30 and 250),
 hip_cm numeric(5,1) check (hip_cm is null or hip_cm between 40 and 250),
 chest_cm numeric(5,1) check (chest_cm is null or chest_cm between 40 and 250),
 arm_cm numeric(5,1) check (arm_cm is null or arm_cm between 10 and 80),
 thigh_cm numeric(5,1) check (thigh_cm is null or thigh_cm between 20 and 120),
 calf_cm numeric(5,1) check (calf_cm is null or calf_cm between 15 and 80),
 neck_cm numeric(5,1) check (neck_cm is null or neck_cm between 20 and 70),
 notes text check (notes is null or char_length(notes) between 1 and 500),
 created_at timestamptz not null default now(),
 check (coalesce(weight_kg, height_cm, body_fat_pct, muscle_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm) is not null)
);
create index body_assessments_student on public.body_assessments(student_id, measured_on desc);
create table public.progress_photos (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete cascade,
 taken_on date not null,
 pose text not null check (pose in ('frente','lado','costas')),
 path text not null check (char_length(path) between 40 and 200),
 created_at timestamptz not null default now(),
 unique (student_id, taken_on, pose)
);
create table public.photo_sharing (
 student_id uuid primary key references public.profiles(id) on delete cascade,
 share_with_pro boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.body_assessments enable row level security;
alter table public.progress_photos enable row level security;
alter table public.photo_sharing enable row level security;
revoke all on public.body_assessments, public.progress_photos, public.photo_sharing from public, anon, authenticated;
grant select, insert, update, delete on public.body_assessments, public.progress_photos, public.photo_sharing to service_role;

-- O usuário pode ver as medidas do aluno? (o próprio aluno ou profissional com vínculo ativo)
create or replace function wellness_private.can_see_body(p_viewer uuid, p_student uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select p_viewer = p_student or exists (select 1 from public.student_professional_links k join public.profiles p on p.id = k.professional_id
  where k.student_id = p_student and k.professional_id = p_viewer and k.state = 'active' and p.role = 'profissional' and p.approved)
$fn$;
-- ...e as fotos? (o próprio aluno, ou profissional ativo se o aluno compartilhou)
create or replace function wellness_private.can_see_photos(p_viewer uuid, p_student uuid) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select p_viewer = p_student or (wellness_private.can_see_body(p_viewer, p_student)
  and exists (select 1 from public.photo_sharing s where s.student_id = p_student and s.share_with_pro))
$fn$;
revoke all on function wellness_private.can_see_body(uuid, uuid), wellness_private.can_see_photos(uuid, uuid) from public, anon, authenticated;

-- Cria ou edita uma avaliação. p_data: {"weight_kg":80.5,"height_cm":175,...,"notes":"..."}
create or replace function wellness_private.save_assessment(p_id uuid, p_student uuid, p_measured_on date, p_data jsonb) returns uuid
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); cur public.body_assessments; result uuid; k text;
 v_notes text := nullif(btrim(coalesce(p_data->>'notes','')), '');
begin
 if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception using errcode = '22023', message = 'Avaliação inválida.'; end if;
 for k in select jsonb_object_keys(p_data) loop
  if k not in ('weight_kg','height_cm','body_fat_pct','muscle_kg','waist_cm','hip_cm','chest_cm','arm_cm','thigh_cm','calf_cm','neck_cm','notes') then
   raise exception using errcode = '22023', message = 'Avaliação inválida.'; end if;
  if k <> 'notes' and jsonb_typeof(p_data->k) not in ('number','null') then raise exception using errcode = '22023', message = 'Use só números nas medidas.'; end if;
 end loop;
 if p_measured_on is null or p_measured_on > wellness_private.today_sp() or p_measured_on < wellness_private.today_sp() - 3650 then
  raise exception using errcode = '22023', message = 'Data inválida.'; end if;
 if p_id is not null then
  select * into cur from public.body_assessments b where b.id = p_id for update;
  if not found or cur.author_id <> actor or not wellness_private.can_see_body(actor, cur.student_id) then raise exception using errcode = '42501', message = 'Avaliação indisponível.'; end if;
 else
  if not wellness_private.can_see_body(actor, p_student) then raise exception using errcode = '42501', message = 'Avaliação só do próprio aluno ou do profissional que o acompanha.'; end if;
  if (select count(*) from public.body_assessments b where b.author_id = actor and b.created_at > now() - interval '1 day') >= 50 then
   raise exception using errcode = '54000', message = 'Limite diário de avaliações atingido.'; end if;
 end if;
 begin
  if p_id is null then
   insert into public.body_assessments (student_id, author_id, measured_on, weight_kg, height_cm, body_fat_pct, muscle_kg, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, notes)
    values (p_student, actor, p_measured_on, (p_data->>'weight_kg')::numeric, (p_data->>'height_cm')::numeric, (p_data->>'body_fat_pct')::numeric, (p_data->>'muscle_kg')::numeric,
     (p_data->>'waist_cm')::numeric, (p_data->>'hip_cm')::numeric, (p_data->>'chest_cm')::numeric, (p_data->>'arm_cm')::numeric, (p_data->>'thigh_cm')::numeric,
     (p_data->>'calf_cm')::numeric, (p_data->>'neck_cm')::numeric, left(v_notes, 500)) returning id into result;
  else
   update public.body_assessments set measured_on = p_measured_on,
    weight_kg = (p_data->>'weight_kg')::numeric, height_cm = (p_data->>'height_cm')::numeric, body_fat_pct = (p_data->>'body_fat_pct')::numeric,
    muscle_kg = (p_data->>'muscle_kg')::numeric, waist_cm = (p_data->>'waist_cm')::numeric, hip_cm = (p_data->>'hip_cm')::numeric,
    chest_cm = (p_data->>'chest_cm')::numeric, arm_cm = (p_data->>'arm_cm')::numeric, thigh_cm = (p_data->>'thigh_cm')::numeric,
    calf_cm = (p_data->>'calf_cm')::numeric, neck_cm = (p_data->>'neck_cm')::numeric, notes = left(v_notes, 500)
    where id = p_id returning id into result;
  end if;
 exception when check_violation or numeric_value_out_of_range then
  raise exception using errcode = '22023', message = 'Informe pelo menos uma medida e confira os números (peso em kg, medidas em cm).';
 end;
 return result;
end $fn$;
create or replace function wellness_private.delete_assessment(p_id uuid) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 delete from public.body_assessments b where b.id = p_id and (b.author_id = actor or b.student_id = actor);
 if not found then raise exception using errcode = '42501', message = 'Avaliação indisponível.'; end if;
end $fn$;
create or replace function wellness_private.list_assessments(p_student uuid)
 returns table (assessment_id uuid, author_name text, mine boolean, measured_on date, weight_kg numeric, height_cm numeric, body_fat_pct numeric, muscle_kg numeric,
  waist_cm numeric, hip_cm numeric, chest_cm numeric, arm_cm numeric, thigh_cm numeric, calf_cm numeric, neck_cm numeric, notes text)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not wellness_private.can_see_body(actor, p_student) then raise exception using errcode = '42501', message = 'Avaliação indisponível.'; end if;
 return query select b.id, case when b.author_id = b.student_id then 'Autoavaliação' else p.display_name end, b.author_id = actor, b.measured_on,
  b.weight_kg, b.height_cm, b.body_fat_pct, b.muscle_kg, b.waist_cm, b.hip_cm, b.chest_cm, b.arm_cm, b.thigh_cm, b.calf_cm, b.neck_cm, b.notes
 from public.body_assessments b join public.profiles p on p.id = b.author_id where b.student_id = p_student order by b.measured_on desc, b.created_at desc limit 200;
end $fn$;

-- Fotos: só o aluno registra e apaga (o app envia/apaga o arquivo no Storage).
create or replace function wellness_private.save_progress_photo(p_taken_on date, p_pose text, p_path text) returns uuid
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); result uuid;
begin
 if not exists (select 1 from public.profiles p where p.id = actor and p.role = 'aluno') then raise exception using errcode = '42501', message = 'Fotos de evolução são do aluno.'; end if;
 if p_pose not in ('frente','lado','costas') or p_taken_on is null or p_taken_on > wellness_private.today_sp() or p_taken_on < wellness_private.today_sp() - 3650
  or coalesce(p_path,'') !~ ('^' || actor::text || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$') then
  raise exception using errcode = '22023', message = 'Foto inválida.'; end if;
 if (select count(*) from public.progress_photos f where f.student_id = actor) >= 300 then raise exception using errcode = '54000', message = 'Limite de fotos atingido. Apague fotos antigas.'; end if;
 insert into public.progress_photos (student_id, taken_on, pose, path) values (actor, p_taken_on, p_pose, p_path)
  on conflict (student_id, taken_on, pose) do update set path = excluded.path, created_at = now() returning id into result;
 return result;
end $fn$;
-- Apaga a foto e devolve o caminho do arquivo (para apagar no Storage).
create or replace function wellness_private.delete_progress_photo(p_id uuid) returns text
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member(); v_path text;
begin
 delete from public.progress_photos f where f.id = p_id and f.student_id = actor returning f.path into v_path;
 if v_path is null then raise exception using errcode = '42501', message = 'Foto indisponível.'; end if;
 return v_path;
end $fn$;
create or replace function wellness_private.list_progress_photos(p_student uuid)
 returns table (photo_id uuid, taken_on date, pose text, path text, shared boolean)
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not wellness_private.can_see_photos(actor, p_student) then
  if wellness_private.can_see_body(actor, p_student) then return; end if;
  raise exception using errcode = '42501', message = 'Fotos indisponíveis.'; end if;
 return query select f.id, f.taken_on, f.pose, f.path, coalesce((select s.share_with_pro from public.photo_sharing s where s.student_id = p_student), false)
  from public.progress_photos f where f.student_id = p_student order by f.taken_on desc, f.pose limit 300;
end $fn$;
create or replace function wellness_private.photo_sharing_status(p_student uuid) returns boolean
 language plpgsql stable security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 if not wellness_private.can_see_body(actor, p_student) then raise exception using errcode = '42501', message = 'Fotos indisponíveis.'; end if;
 return coalesce((select s.share_with_pro from public.photo_sharing s where s.student_id = p_student), false);
end $fn$;
create or replace function wellness_private.set_photo_sharing(p_share boolean) returns void
 language plpgsql security definer set search_path = '' as $fn$
declare actor uuid := wellness_private.require_member();
begin
 insert into public.photo_sharing (student_id, share_with_pro) values (actor, coalesce(p_share, false))
  on conflict (student_id) do update set share_with_pro = excluded.share_with_pro, updated_at = now();
end $fn$;
-- Storage: abrir a foto (dono ou profissional ativo com compartilhamento).
create or replace function wellness_private.can_open_progress_photo(p_path text) returns boolean
 language sql stable security definer set search_path = '' as $fn$
 select exists (select 1 from public.progress_photos f where f.path = p_path and wellness_private.can_see_photos(auth.uid(), f.student_id))
$fn$;

create or replace function public.save_assessment(p_id uuid, p_student uuid, p_measured_on date, p_data jsonb) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_assessment(p_id, p_student, p_measured_on, p_data)$$;
create or replace function public.delete_assessment(p_id uuid) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.delete_assessment(p_id)$$;
create or replace function public.list_assessments(p_student uuid)
 returns table (assessment_id uuid, author_name text, mine boolean, measured_on date, weight_kg numeric, height_cm numeric, body_fat_pct numeric, muscle_kg numeric,
  waist_cm numeric, hip_cm numeric, chest_cm numeric, arm_cm numeric, thigh_cm numeric, calf_cm numeric, neck_cm numeric, notes text)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_assessments(p_student)$$;
create or replace function public.save_progress_photo(p_taken_on date, p_pose text, p_path text) returns uuid
 language sql security invoker set search_path = '' as $$select wellness_private.save_progress_photo(p_taken_on, p_pose, p_path)$$;
create or replace function public.delete_progress_photo(p_id uuid) returns text
 language sql security invoker set search_path = '' as $$select wellness_private.delete_progress_photo(p_id)$$;
create or replace function public.list_progress_photos(p_student uuid) returns table (photo_id uuid, taken_on date, pose text, path text, shared boolean)
 language sql stable security invoker set search_path = '' as $$select * from wellness_private.list_progress_photos(p_student)$$;
create or replace function public.photo_sharing_status(p_student uuid) returns boolean
 language sql stable security invoker set search_path = '' as $$select wellness_private.photo_sharing_status(p_student)$$;
create or replace function public.set_photo_sharing(p_share boolean) returns void
 language sql security invoker set search_path = '' as $$select wellness_private.set_photo_sharing(p_share)$$;

revoke all on function
 wellness_private.save_assessment(uuid,uuid,date,jsonb), public.save_assessment(uuid,uuid,date,jsonb), wellness_private.delete_assessment(uuid), public.delete_assessment(uuid),
 wellness_private.list_assessments(uuid), public.list_assessments(uuid), wellness_private.save_progress_photo(date,text,text), public.save_progress_photo(date,text,text),
 wellness_private.delete_progress_photo(uuid), public.delete_progress_photo(uuid), wellness_private.list_progress_photos(uuid), public.list_progress_photos(uuid),
 wellness_private.photo_sharing_status(uuid), public.photo_sharing_status(uuid), wellness_private.set_photo_sharing(boolean), public.set_photo_sharing(boolean),
 wellness_private.can_open_progress_photo(text)
 from public, anon, authenticated;
grant execute on function
 wellness_private.save_assessment(uuid,uuid,date,jsonb), public.save_assessment(uuid,uuid,date,jsonb), wellness_private.delete_assessment(uuid), public.delete_assessment(uuid),
 wellness_private.list_assessments(uuid), public.list_assessments(uuid), wellness_private.save_progress_photo(date,text,text), public.save_progress_photo(date,text,text),
 wellness_private.delete_progress_photo(uuid), public.delete_progress_photo(uuid), wellness_private.list_progress_photos(uuid), public.list_progress_photos(uuid),
 wellness_private.photo_sharing_status(uuid), public.photo_sharing_status(uuid), wellness_private.set_photo_sharing(boolean), public.set_photo_sharing(boolean),
 wellness_private.can_open_progress_photo(text)
 to authenticated;

do $storage$
begin
 if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('evolucao', 'evolucao', false, 8388608, array['image/jpeg','image/png','image/webp'])
   on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute $p$create policy "evolucao: aluno envia na própria pasta" on storage.objects for insert to authenticated
   with check (bucket_id = 'evolucao' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "evolucao: dono ou profissional autorizado abre" on storage.objects for select to authenticated
   using (bucket_id = 'evolucao' and ((storage.foldername(name))[1] = auth.uid()::text or wellness_private.can_open_progress_photo(name)))$p$;
  execute $p$create policy "evolucao: aluno apaga" on storage.objects for delete to authenticated
   using (bucket_id = 'evolucao' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
 end if;
end $storage$;

-- Exclusão/anonimização de conta passa a apagar também medidas e fotos.
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
    ('hydration_days','user_id'),('hydration_settings','user_id'),('challenge_participants','user_id'),('account_identity','user_id'),('partner_verifications','user_id'),('body_assessments','student_id'),('progress_photos','student_id'),('photo_sharing','student_id')) v(t, col) loop
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
