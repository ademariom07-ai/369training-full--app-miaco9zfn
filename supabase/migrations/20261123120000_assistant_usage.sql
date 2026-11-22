-- Assistente virtual (Nina): conta as mensagens por pessoa para o limite diário da Edge Function "nina".
-- Só a chave de serviço (dentro da função) lê e grava; ninguém acessa pelo app.
create table public.assistant_calls (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index assistant_calls_user on public.assistant_calls(user_id, created_at desc);
alter table public.assistant_calls enable row level security;
revoke all on public.assistant_calls from public, anon, authenticated;
grant select, insert, delete on public.assistant_calls to service_role;
comment on table public.assistant_calls is 'Uso da assistente Nina (limite diário). Só service_role.';
