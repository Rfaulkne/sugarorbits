# Automatic five-minute Dexcom collection

The working manual `dexcom-sync` and its JWT verification remain unchanged.
This release adds a separate server-only `dexcom-auto-sync`, plus two cron jobs.
Nothing is activated by committing these files; the dashboard steps are required.

1. SQL Editor: run `supabase/setup/01_create_scheduler_token.sql`. It creates a
   random 256-bit token in Supabase Vault. The result IS A SECRET: do not paste it
   in chat, screenshots, GitHub or app code. Re-running reuses the same token.
2. Copy its value into Edge Functions → Secrets, name `DEXCOM_SYNC_TOKEN`.
3. Deploy NEW function `dexcom-auto-sync` with all of
   `supabase/functions/dexcom-auto-sync/index.ts`. For ONLY this new function,
   turn platform JWT verification OFF: an unattended job has no user's login JWT.
   The code itself rejects every call without the matching secret token, rejects
   browser origins, and uses only the configured DEXCOM_OWNER_USER_ID. It does not
   accept an owner or credentials in the request body. Do not toggle JWT settings
   on `dexcom-sync`, `food-genie` or any other existing function.
4. Run `supabase/setup/02_enable_schedules.sql`. It enables Cron/pg_net and creates
   named five-minute sync and hourly retention jobs. Re-running updates those same
   names (no duplicate jobs). Stop and report any SQL error; don't disable RLS.
5. Wait for the next 5-minute boundary. Leave the phone app closed. Then open it
   and tap Refresh status, NOT Fetch, and verify Last successful fetch advances.
   `03_check_schedules.sql` helps check HTTP status without selecting secrets or
   readings. A successful Cron run alone only means its HTTP request was queued.

The public apikey in the scheduler is only a gateway routing key, not the auth
credential. The custom random token is the handler's authentication. Its scope is
triggering this owner's sync, not arbitrary DB access. The database's existing
60s throttle/120s lease serialize scheduled and manual calls.

The decrypted scoped token briefly exists in pg_net's request queue, accessible
to database administrators. Vault encryption is not protection against your own
database administrator. No values are printed by the job. In case of exposure,
pause the sync job and rotate both the Vault and Edge Function copies together.

Each successful sync prunes expired glucose immediately. The separate hourly job
removes live glucose/event rows >28d old even if collection fails (up to one hour
after expiry), and stale Share sessions >7d. Provider backups/logs have their own
retention. RLS also hides expired glucose immediately from browser reads.

No AI is invoked by scheduled collection. No automatic 14-day backfill or Pi
migration is included. The cloud window grows from Share's available recent 24h;
the visible rolling view and coach are separate work. Requests may fail if the
project is paused/unavailable or Share is down. Verify scheduler/HTTP/sync status;
never treat the cloud as a replacement for Dexcom alerts.

To pause without deleting anything:

```sql
update cron.job set active=false where jobname='orbit-dexcom-every-five-minutes';
```

Keep retention active. To resume, set active=true for that same sync job.

Automated tests here use mocks. Live Cron installation, gateway behaviour, Vault
access and uninterrupted collection need verification in the actual project.
