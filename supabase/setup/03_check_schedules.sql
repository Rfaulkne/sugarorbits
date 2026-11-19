-- SQL Editor: safe operational output. No readings, passwords or tokens selected.
select j.jobname,j.schedule,j.active,d.status,d.start_time,d.end_time,d.return_message
from cron.job j left join lateral (
  select status,start_time,end_time,return_message from cron.job_run_details
  where jobid=j.jobid order by start_time desc limit 1
) d on true
where j.jobname in ('orbit-dexcom-every-five-minutes','orbit-retention-hourly');
-- Cron success only confirms enqueueing, not that the HTTP request succeeded.
select id,status_code,timed_out,error_msg,created
from net._http_response order by created desc limit 5;
select succeeded_at,latest_at,error_code from public.orbit_glucose_sync;
