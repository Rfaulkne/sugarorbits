-- Run after deploying dexcom-auto-sync and saving DEXCOM_SYNC_TOKEN.
-- No secret values are embedded in this script or in the scheduled SQL text.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists(select 1 from vault.secrets where name='orbit_dexcom_sync_token') then
    raise exception 'Create the scheduler token first';
  end if;
end $$;
select cron.schedule('orbit-dexcom-every-five-minutes','*/5 * * * *', $job$
  select net.http_post(
    url := 'https://hinknpgmmhkqphsgvuek.supabase.co/functions/v1/dexcom-auto-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_',
      'x-orbit-sync-token',(select decrypted_secret from vault.decrypted_secrets where name='orbit_dexcom_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);
-- Independent cleanup still runs if Share or the collector has an outage.
select cron.schedule('orbit-retention-hourly','17 * * * *', $job$
  delete from public.orbit_glucose where recorded_at < now()-interval '28 days';
  delete from public.orbit_events where occurred_at < now()-interval '28 days';
  delete from public.orbit_share_session where updated_at < now()-interval '7 days';
$job$);
commit;
-- This output contains no secret values.
select jobname,schedule,active from cron.job
where jobname in ('orbit-dexcom-every-five-minutes','orbit-retention-hourly');
