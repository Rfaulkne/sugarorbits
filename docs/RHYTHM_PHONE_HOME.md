# Rhythm-first phone release

Navigation is Rhythm / Focus / Food Genie. Quick Activity/Stress/Other logging is
available above all three panels, folds away after a successful save, and can be
reopened with Log moment. It does not reopen on each tab switch. Undo remains.

Rhythm uses the owner's RLS-protected stored glucose and latest 20 event tags.
Cursor pagination prevents Supabase's per-request row limit truncating the history.
No dummy curves or interpolated missing sections are added. Clock is Europe/Berlin.
Current profile: seven completed local dates; ghost: preceding seven completed dates.
Each half-hour averages eligible daily means equally. >=70% of actual five-minute
slots in that half-hour is needed (DST repeated/missing clock time is accounted for).
Central in-range proportion is of recorded five-minute samples, not an assurance
about unrecorded time. Coverage and preliminary-data notices remain visible.

The faint circles mark 3.9 and 10 mmol/L. Coloured profile strokes reflect mean
threshold crossings, while separate orange/blue arcs reflect sample frequency.
Context dots are event timestamps, not asserted causes. The Pi is unchanged.

Focus is one shared thread whether opened from Rhythm's card or Focus navigation.
User chooses high/low three-hour period or tagged activity, writes an observation
or experiment and starts seven days. Baseline aggregates are frozen at start.
Daily Tried it / Not today / Skip and optional notes upsert one entry per local day.
At seven days the reflection state appears, with no automatic resolution verdict.
Finishing clears the local plan. There is no streak, score or treatment advice.

**Storage boundary:** this plan/check-ins/notes and frozen aggregate baseline are
account-ID-scoped browser localStorage only, not Supabase or Pi synced. Read-time
expiry removes a focus after 28 days; clearing site data also removes it. It stays
hidden from other account logins but is not encrypted against a device/browser
administrator. No raw glucose, tokens or photographs are persisted by this feature.

The existing cloud API provides no focus tables yet. This release is guided
check-ins, explicitly NOT AI conversation; no glucose or plan is sent to OpenAI.
Actual AI coaching, push notifications and cloud-synced plans remain follow-ups.

Progress requires complete three-hour windows with >=70% sample coverage. Windows
that began before the experiment or have not ended are excluded. Days affected
require three consecutive out-of-range samples (no >6min gap); these are not raw
reading counts labelled as separate events. At least five covered windows in both
periods is the minimum for interpretation, not proof of causation. High/low/in-range
fractions and eligible counts are all shown; missing coverage is not improvement.

Tagged activity means a fixed two-hour window after a logged Activity event, not
verified gym attendance or exercise duration. >=17/24 slots are needed. Overlapping
tag windows are deduplicated conservatively. Untagged activity is unknown, and only
the newest 20 tags can participate. No activity-to-glucose causal attribution.

Data updates on sign-in and Refresh status / Fetch. There is no continuous browser
collector or polling loop. A failed history load displays a warning rather than
presenting a partial paginated dataset as a complete comparison. The scheduled
server collector is separate and must still be verified operationally.

Checks: pure statistics tests (DST, equal-day means, dedupe/invalid values, coverage,
window eligibility, episodes and overlapping tags); mocked phone flows including
focus, quick log, Food Genie and history pagination. Live iPhone camera, real-data
comparison accuracy and cross-user Supabase policies remain device/project QA.
