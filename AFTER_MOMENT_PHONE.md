# Rhythm: after a moment

Activity / Stress / Other filters and a compact moment picker show the actual glucose samples following a saved timestamp. Select 1, 3 or 6 elapsed hours. This is not a pooled average or a causal attribution.

- Queries only the signed-in owner's existing glucose rows through Supabase RLS. No new SQL, secrets or function deployment.
- Includes the most recent 20 saved taps, subject to the existing 28-day retention. Each trace fetches its own window, including older taps outside the weekly profile query.
- Purple range band: 3.9–10 mmol/L. Orange/blue clips the actual line at those thresholds. No curve smoothing or invented readings. Gaps over 10 minutes break the line; isolated readings remain dots.
- Future portions are shaded and marked pending. Refresh this window reads the cloud copy; it does not force Dexcom collection. No automatic browser polling.
- All traces stay in memory; sign-out clears the plot and invalidates in-flight results. Fast selection changes cannot replace a newer trace with an older response.
- Time labels use the viewing phone's zone; duration is elapsed time, including across DST. The existing weekly orbit remains Europe/Berlin.

Checks: `node tests/test_after_moment.cjs`, `node tests/test_cloud_phone.cjs`, `node tests/test_rhythm.cjs`, `node tests/test_phone_layout.cjs`.

On a phone, sign in, open Rhythm, scroll to After a moment, choose a category and timestamp, then switch 1h / 3h / 6h. A newly logged tap may have no later samples yet. No AI call is made by this viewer.
