# Phone Dexcom connection test

The Coach section now provides Fetch Dexcom data and Refresh status. This does
not enable automatic collection, AI coaching, Pi pairing or glucose alarms.

- Fetch calls the deployed `dexcom-sync` with the signed-in user's JWT and an
  empty body. No client-selected owner or credentials are submitted.
- Refresh only reads the latest stored reading and sync status through RLS.
- Value conversion is mg/dL divided by 18, displayed to one decimal mmol/L.
- Both reading time and last successful fetch are shown in the phone's local time.
- Reading age >15min is labelled old at the time of the check, regardless of
  whether the fetch succeeded. A failed fetch never disguises saved data as new.
- Values/timestamps failing validation are not shown. Nothing is sent to OpenAI.
- No tokens, glucose values or timestamps are persisted in browser storage.

User validation: sign in, open Coach, tap Fetch, compare several values/times
with Dexcom and verify the correct owner in Supabase. Share only an error message
when troubleshooting; no keys/passwords are needed. A 401 must not be resolved
by disabling authentication. Supabase gateway or origin issues need diagnosis.

Mocked tests cover empty/recent/stale/invalid results, JWT forwarding, logout
cleanup and the existing Food Genie/logger regressions. Live server policy
isolation, credentials and Dexcom accuracy remain unverified here.
