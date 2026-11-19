# Calm Rhythm revision

Retires the interactive seven-ring prototype on the phone only. One static mean glucose orbit, 3 or 7 completed Berlin calendar days. Previous comparison uses the equally long preceding period. Half-hour means have equal weights per adequately covered day; gaps are not filled. Centre TIR is the fraction of recorded samples, not a day-weighted average. The mean can conceal individual excursions.

Short cards distinguish recurring clock windows from two-hour post-activity/stress associations. Clock recurrence keeps the existing minimum of three affected and three eligible days, with at least half the eligible days affected. With only three days selected this is intentionally conservative. An affected day contains three consecutive five-minute readings outside range; eligibility requires 70% window coverage.

Tag observations require at least three non-overlapping, complete two-hour windows on three distinct dates within the selected period. Each window needs at least 17 of 24 relative five-minute bins. Each tap gets equal weight in high/low/in-range percentages. Recurring high/low labels require episodes in at least half of covered windows. Mostly in range means an average recorded-sample in-range fraction of at least 70%, not proof that every window was in range. Sparse tags yield no conclusion. Newest-20-tag retention limits all context.

Selecting a clock card highlights that window on the daily average. Selecting a tag card replaces the orbit with a relative two-hour average: top=tap, right=30 minutes, bottom=60, left=90. It is explicitly labelled, not presented as a 24-hour clock. Back to daily average restores normal time-of-day mapping. Pointwise relative means require coverage across at least 70% of eligible tap windows.

These cards are deterministic observations, not AI-generated or AI-reviewed findings. Review with coach carries the selected observation's label to Coach but does not call AI or create a plan. The existing AI chooser reviews seven days and supports recurring high/low windows and activity-window candidates. Stress-tag AI focus selection/tracking still needs a separate backend extension; no unsupported stress candidate is passed as a clock focus. Existing active plans, notifications, auth and Pi are unchanged.

Explanations and the individual-tap explorer are collapsed. The old day slider, pointer callbacks and mode controls are no longer loaded. Archived lens source/tests remain for reference. No new SQL/function setup is required for this frontend revision.

Checks: test_calm_rhythm.cjs, test_cloud_phone.cjs, existing rhythm, focus, after-moment and phone layout suites. Phone touch/install and real-data visual review remain device checks.
