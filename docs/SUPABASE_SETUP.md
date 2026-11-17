# Private phone logging — first connection test

This isolated `cloud-phone/` client does not replace the working Pi or the hosted
synthetic preview. It uses only the supplied public project URL/publishable key.
No secret key, Dexcom credentials, glucose uploads, AI, notifications or photo
storage are included. Deployment is pending database setup and authorization QA.

## In the Supabase dashboard

1. Authentication → settings: disable new user signups and anonymous sign-ins.
   Keep email/password sign-in enabled. This is a closed personal pilot.
2. Authentication → Users → Add user → Create new user. Use your own email and a
   unique password, not your Dexcom password. Confirm this manually created user
   using the dashboard option; do not share its password in chat.
3. SQL Editor → New query: paste and run
   `supabase/migrations/202611170001_private_events.sql` once. If it errors, stop
   and share the error, not credentials. All statements are in one transaction.
4. Verify `orbit_events` has RLS enabled and three owner-only policies. There is
   no public/anonymous grant. Do not disable RLS to fix an empty result.
5. Enable Supabase Cron and schedule this SQL hourly to enforce deletion even
   when the app is not used (until configured, insert-time trimming is the only
   physical cleanup):

   ```sql
   delete from public.orbit_events
   where occurred_at < now() - interval '28 days';
   ```

The latest 20 events are retained per owner. Expired events are hidden by the
client immediately; hourly cleanup deletes live rows up to an hour after expiry.
Provider backups/logs follow provider retention, not this live-table policy.

## Before using real events

Deploy `cloud-phone/` over HTTPS, separately from the current demo. No secrets
belong in those files. This initial page keeps sessions in memory; reloading
requires login. Persistent sessions/PWA installation are follow-up work.

Test two dashboard-created users A and B using synthetic tags:

- Anonymous table reads/writes must be denied.
- A can create, read and delete their tags.
- B cannot read/delete A's UUID or insert a row with A's user_id.
- Neither user can update rows (not granted).
- Insert 21 tags: exactly 20 remain for that owner; B is unaffected.
- Confirm scheduled retention job exists and succeeds.

Do not upload CGM data until authentication/isolation is verified. A public
publishable key alone does not grant access; the user's JWT plus RLS does.
The Supabase dashboard is administrative and bypasses ordinary user isolation,
so dashboard visibility is not a test of RLS.

## Remaining phases

Deploy private test page; test iPhone/login/isolation; then add authenticated Pi
pairing and aggregate sync. Coach, food-photo consent, push subscriptions and
scheduled check-ins are separate server features, not implemented here.
