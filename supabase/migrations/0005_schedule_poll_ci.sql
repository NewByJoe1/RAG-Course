-- 0005_schedule_poll_ci.sql
-- pglite: skip  (needs Supabase's pg_cron, pg_net and Vault)
--
-- Runs the poll-ci edge function every 15 minutes.
--
-- Before this does anything useful, create two Vault secrets (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/poll-ci', 'poll_ci_url');
--   select vault.create_secret('<same value as the POLL_CI_SECRET function secret>', 'poll_ci_secret');
-- Until they exist, each run posts nowhere and is recorded as a failed job in
-- cron.job_run_details.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'poll-ci',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'poll_ci_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_ci_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
