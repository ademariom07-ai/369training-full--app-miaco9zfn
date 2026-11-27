-- A função de envio foi publicada no painel com o nome "super-task" (nome sugerido pelo editor).
-- O agendador passa a chamar esse endereço. (Só no Supabase; o banco de teste local não tem pg_cron/pg_net.)
do $sched$
begin
 if exists (select 1 from pg_extension where extname = 'pg_net') and exists (select 1 from pg_namespace where nspname = 'cron') then
  perform cron.schedule('wellness-push-sender', '* * * * *', $cmd$select net.http_post(
    url := 'https://elahjmtboqhqqxmoaths.supabase.co/functions/v1/super-task',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', (select value from wellness_private.app_settings where key = 'push_cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 25000)$cmd$);
 end if;
end $sched$;
