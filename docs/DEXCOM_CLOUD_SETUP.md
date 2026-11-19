# Cloud Dexcom collection: single-owner connection test

This is a staged backend, not an enabled automatic collector or coach. Pi remains
unchanged. Supabase Edge Functions use Deno, so this implements the documented
Share HTTP flow used by pydexcom rather than installing its Python package.

1. SQL Editor: run `supabase/migrations/202611190001_private_glucose.sql` once.
2. Authentication → Users → open YOUR phone-login user → copy its UUID.
   Edge Functions → Secrets: save it as `DEXCOM_OWNER_USER_ID`.
   This is the Supabase user ID, not a Dexcom account ID. Do not guess/select the
   first user if multiple accounts exist. This explicitly binds these personal
   Dexcom credentials to one owner and prevents another signed-in user syncing them.
3. Secrets already saved: DEXCOM_SHARE_USERNAME, DEXCOM_SHARE_PASSWORD,
   DEXCOM_SHARE_REGION (us / ous / jp). Do not paste their values into code/chat.
4. Deploy a new Edge Function named `dexcom-sync`, replacing its template with
   `supabase/functions/dexcom-sync/index.ts`. KEEP JWT verification enabled.
5. Phone UI connection/test button is a separate next change. It sends the owner's
   session JWT, never service credentials. Don't test with an anonymous API key or
   disable authentication to clear a 401.

Runtime uses the server-injected default secret key, with legacy service-role
fallback. No backend secret is returned to browsers. The table of cached Share
session IDs has no anonymous or authenticated grants/policies. Readings and sync
status have owner-only SELECT policies; users cannot insert/update/delete via API.

## Checks before scheduling or coaching

- Anonymous and a second user's access must fail or return no owner's rows.
- Both must be unable to read `orbit_share_session` or invoke service-only RPCs.
- Owner sync then verify latest UTC timestamp, mmol/L conversion (mg/dL / 18),
  date/local-time rendering and several values against Dexcom.
- Repeated sync deduplicates timestamps. Invalid readings fail the entire batch.
- Sync age >15m is stale even if a request succeeded. Zero readings is an error,
  not a fabricated normal glucose day. Missing dates remain missing.
- Atomic database claim serializes calls, 60s cooldown, 120s lease. Share sessions
  cached per credential fingerprint; only session errors get one login retry.
- SQL RPC stores batch/status atomically and prunes rows older than 28 days on
  each successful sync. Expired rows are hidden by RLS even without new syncs.

## Explicitly pending

No live credentials or readings were available to local tests. No Supabase tables,
function or cloud schedule has been created by this repository change. Deploy and
verify manually first. The function only accepts its configured owner's JWT; cron
service authentication is intentionally NOT enabled in this phase.

Then: five-minute scheduled collection with a server-only authorization mechanism,
independent daily retention cleanup (so physical rows are purged if sync fails),
phone pattern calculation and seven-day baseline, coach connection, Pi history
import and optional display pairing. Provider backups/log retention are separate.
There is no automatic 7/28-day backfill: Share supplies up to 24h/288 readings.

Supabase account deletion cascades these rows; removing/rebinding the configured
owner must be an explicit administrator action, not a browser input.
