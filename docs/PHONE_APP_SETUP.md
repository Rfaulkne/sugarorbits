# Sugar Orbits: installed phone app and cloud focus loop

This revision adds the installable phone shell, optional remembered sign-in, private cloud focus/check-ins, AI-assisted reflective questions, tag context, seven-day review, and opt-in timed/maintenance reminders. Pi code is unchanged.

**Publication of the frontend does not deploy Supabase functions or enable push.** Complete these steps in your existing project. Never paste private keys or tokens into chat or GitHub.

## 1. Add the private tables

In Supabase → SQL Editor → New query, paste and run the complete file:

`supabase/migrations/202611190002_focus_and_push.sql`

It is additive/rerunnable. It creates private plans, server-only push devices/delivery deduplication, a service-only compare-and-swap writer, and an independent hourly retention job. Existing glucose/events and collection schedules are not altered. Reads use owner RLS; clients cannot directly write plans or read subscriptions. Up to five plans, one active, and three devices per owner are allowed. Plans and notes expire 28 days after creation; devices expire after 28 days without re-registration. Expired records are hidden immediately and physically removed hourly. Backups have separate provider retention.

## 2. Deploy cloud focus and updated pattern choices

Create `orbit-focus` in Edge Functions. Paste the complete generated `supabase/functions/orbit-focus/index.ts`, not `handler.js`. Keep gateway JWT verification ON. Existing `OPENAI_API_KEY` and server-injected Supabase secrets are used; never add them to the phone.

Update existing `orbit-coach` using its regenerated `supabase/functions/orbit-coach/index.ts`, JWT verification ON. This adds retained tag counts to recurring-window suggestions.

Reload the phone app, sign in and tap Focus → Refresh cloud focus. It should say **Cloud focus connected**. Until this works the app explicitly retains device-only mode; it never claims a local plan is synced. An existing device-only plan can start a NEW cloud week using its experiment text; old dates/check-ins are not silently backdated or copied.

Start one cloud focus and save a check-in. Reopen on a second signed-in browser to confirm it appears. Review compares covered windows, not raw sample counts across unequal days. Activity context only knows the newest 20 retained taps; it cannot reconstruct pruned or unlogged activity.

## 3. Create the push keys

Open the app's `/moments/push-setup.html` on your own device. Tap **Generate a VAPID key pair locally**. The page generates keys locally using Web Crypto and has no upload/storage code. Copy the displayed values into Supabase → Edge Functions → Secrets:

- `ORBIT_VAPID_PUBLIC_KEY`
- `ORBIT_VAPID_PRIVATE_KEY` (secret)
- `ORBIT_VAPID_SUBJECT` = your contact in `mailto:you@example.com` format

Keep the pair stable; rotating it requires re-registering phones. Do not send screenshots of the generated private key. Close the generator when done.

Run `supabase/setup/04_create_reminder_token.sql` in SQL Editor. Its final output is SECRET. Copy it only into Edge Functions → Secrets as `ORBIT_REMINDER_TOKEN`. Vault retains the same token for cron. Do not reuse the Dexcom scheduler token. The existing `DEXCOM_OWNER_USER_ID` scopes this first personal reminder sender to your account.

## 4. Deploy and schedule the sender

Create `orbit-reminders`, paste the complete generated `supabase/functions/orbit-reminders/index.ts`. Gateway JWT verification is OFF **for this scheduler function only**: it rejects browser Origins and requires the private scoped token. Leave `orbit-focus`, `orbit-coach`, `food-genie` and manual `dexcom-sync` verification ON. `web-push@3.6.5` is imported by the server; no npm install is needed on your Pi/phone.

Run `supabase/setup/05_enable_reminders.sql`. Its safe output should show `orbit-focus-reminders` every five minutes and `orbit-focus-retention-hourly` active. This does not replace Dexcom jobs.

## 5. Install on iPhone and opt in

Open `https://sugar-orbits-pocket-preview.firmvale1.chatgpt.site/moments/` in Safari → Share → Add to Home Screen. Open the new icon. The existing private ChatGPT hosting gate is intentionally unchanged and may still require its own sign-in; this is not yet a standalone public release/domain or Face ID implementation.

Sign into Sugar Orbits. Optionally tick **Keep me signed in on this personal device**. Tokens, never passwords/photos, are then stored in browser local storage. Anyone opening the unlocked app can access the session. Sign-out removes saved tokens and unsubscribes this browser from push. If server removal cannot be confirmed, the app warns you; iPhone Notification Settings can also disable it. Service-worker code has no fetch handler/cache: no offline health/auth data is cached.

In Focus, tap **Enable notifications on this phone**, allow the system prompt, and separately enable/save the active focus reminder. Permission is requested only from this tap, not login. Home Screen Web Push needs iOS 16.4+ and an internet connection. The browser may have separate storage from the installed app.

## 6. Verify a real delivery before relying on reminders

For an activity focus, choose a reminder clock time a few minutes ahead, **At the start**, quiet hours not covering it, and save. Close the app and lock the phone. Wait for a scheduled run. A generic Sugar Orbits notification should open Focus. For clock-window focuses, reminders occur at/15/30 minutes before the actual selected window (Europe/Berlin), not an arbitrary daily check-in.

Check Edge Function invocation status and the delivery table as administrator if nothing arrives. `accepted` means the push service accepted the message, not that the phone displayed it. Focus modes, connectivity, OS decisions and revoked permissions can delay/suppress delivery. There is no diagnostic event payload with glucose, tags or written reflections. Failed/uncertain sends are not automatically retried for the same slot, avoiding duplicates at the cost of an occasional missed reminder. The 15-minute due window intentionally skips old reminders after an outage.

## Coach behavior and honest limits

- Pattern suggestions are computed from real covered days; AI ranks verified choices. Tag counts describe overlap, not causes.
- Ask coach sends only computed before/during summaries, tag/check-in counts and phase. It does not send experiment text, notes, reflections or raw readings. AI selects from a checked library of gentle questions and observation ideas. This is bounded AI-assisted reflection, not an open-ended clinical chatbot. Requests are explicit and share the existing 20/day, ten-second-cooldown quota with Food.
- Seven days, at least five covered windows per period: a high/low focus is labelled clearer improvement only when the target fraction falls by at least five percentage points AND halves, without material counter-tradeoffs. An activity focus needs a ten-point rise in time in range. These are provisional product heuristics, not validated clinical criteria or a claim that something is permanently solved. Low exposure rising by over one point or high exposure rising by over five points produces a mixed result. Coverage and both high/low fractions remain visible.
- The day-seven reflection asks what you think helped. Saving it moves the plan to Keep what helped, frees the active slot and leaves reminders OFF until opted into a weekly maintenance reminder. No automatic success/causal claim or treatment instruction is generated.
- Quiet hours skip the reminder. The first after-week review notification is sent once, not repeated daily. Existing same-day check-ins suppress active daily reminders. Maintenance reminders follow the saved window/quiet hours on the reflection's weekday, until paused or the 28-day plan expires.
- Five plan slots are available; finish a plan to stop its reminders or remove finished reflections to free slots. There is no permanent habit archive outside the retention limit.
- Pi pairing, passkeys/Face ID, public hosting, food-event persistence and freeform AI follow-up are still separate work. Existing Pi and collectors remain untouched.

## Verification in this revision

Mocked tests: focus stats/coverage/DST/quiet hours, owner-authenticated server CRUD and revision conflicts, aggregate-only AI payloads and enum rejection, server-only scheduler token/origin checks, endpoint allowlist/no redirects, reminder deduplication, phone cloud focus/check-ins/review/maintenance, remembered-sign-in cleanup, legacy modes, and existing Food/Dexcom flows.

No real secrets/health data or live AI calls are used in tests. PostgreSQL migration execution, Deno npm compatibility, iPhone installation/session persistence and real push delivery require the setup/device checks above. Do not label push complete before that real delivery test.

To regenerate the dashboard-ready functions after source edits: `node tests/build_focus_functions.cjs` and `node tests/build_coach_function.cjs`.
