# Activity and stress: AI choice and progress tracking

No new SQL, keys, or Pi update. The existing private plan JSON supports the new stress kind. Backend functions must be redeployed; publishing the phone does not deploy them.

## Activate

In the existing Supabase Edge Function editor, replace the entire code with these generated files and Deploy:

1. `supabase/functions/orbit-coach/index.ts` — JWT verification stays ON.
2. `supabase/functions/orbit-focus/index.ts` — JWT verification stays ON.
3. If scheduled push is enabled: `supabase/functions/orbit-reminders/index.ts` — retain its existing gateway verification OFF and private scheduler token. This update makes stress use the chosen reminder clock rather than a fictitious daily stress window. No schedule or key changes.

Then open the phone → Coach → Refresh cloud focus. Existing glucose collection and plans are unchanged. A stress start is gated until the new focus function reports tag_focus_version 2.

## Try

On Rhythm, select an eligible After activity / After stress observation and tap Ask AI. It opens Coach and explicitly requests candidates for that tag type only. The AI reviews a rolling seven-day period (even when Rhythm displays three completed days), not the client's calculations. It can suggest noticing highs, lows, mixed outcomes or maintaining predominantly in-range patterns. Nothing is started until you choose a suggestion, enter your experiment and Start my seven days. An existing active focus is never replaced by this action.

Alternatively, choose After stress / After activity in the manual focus picker. A custom observation can start with little data, but no meaningful before/after conclusion is produced without adequate baseline and follow-up coverage.

## Calculations and privacy

- Each type uses two hours after its own timestamped taps. At least 17/24 relative five-minute bins per window; duplicates/overlaps excluded; at least three distinct dates and three eligible windows before it can be an AI candidate. Raw readings are deduplicated/validated before scoring. Tags on many occasions on one day do not establish a multi-day pattern.
- High/low episodes require three consecutive samples with no gap over six minutes. The AI receives only the server-computed aggregate candidates, never raw traces, tag timestamps, user IDs, notes or credentials. It chooses known candidate IDs and a bounded, validated question; model text cannot alter statistics or prescribe treatment.
- The server freezes the aggregate tag baseline at start. It remains fixed when old raw tags fall out of the newest-20 retention. No raw tag archive is added. Follow-up can still be incomplete because only retained/logged taps are known; this is surfaced, not treated as success.
- A review needs at least five covered windows and three distinct dates in both periods. High/low exposure and TIR remain visible together. Predominantly in-range coverage can be labelled broadly maintained; no claim that a cause is established or a pattern permanently solved. Old activity plans without distinct-date baseline metadata cannot meet the new review threshold; start a new plan when appropriate, never backfill that count.
- Post-tag reminders use the clock chosen by the user; stress/exercise timing is not predicted. Quiet hours, opt-in subscriptions, 28-day expiry and daily reminder deduplication are unchanged.
- AI choices and follow-up still use explicit button taps and the shared 20/day quota. Background reminders do not invoke AI. Reflection remains bounded AI-assisted habit tracking, not freeform medical coaching.

## Checks

`node tests/build_coach_function.cjs` and `node tests/build_focus_functions.cjs` regenerate dashboard bundles. Mocked tests cover stress high/low/in-range candidates, explicit tag filtering, sparse/repeated-day rejection without AI calls, owner/auth scopes, fixed baseline after raw-tag pruning, progress/maintenance, chosen-clock reminders, stress plan save and UI labels. No live AI, Supabase mutation or actual notification delivery is performed by these tests. After deployment, confirm one real suggestion and a saved stress plan on the phone.
