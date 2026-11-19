-- Run only AFTER configuring and deploying orbit-reminders.
-- Does not alter Dexcom collection or existing retention jobs.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.secrets where name='orbit_reminder_token') then raise exception 'Create the reminder token first'; end if;
end $$;
select cron.schedule('orbit-focus-reminders','*/5 * * * *',$job$
 select net.http_post(
  url:='https://hinknpgmmhkqphsgvuek.supabase.co/functions/v1/orbit-reminders',
  headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_M-0fIrNtiOrSOoDfpjh2TA_dUvGCRx_','x-orbit-reminder-token',(select decrypted_secret from vault.decrypted_secrets where name='orbit_reminder_token')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$job$);
commit;
select jobname,schedule,active from cron.job where jobname in('orbit-focus-reminders','orbit-focus-retention-hourly');
