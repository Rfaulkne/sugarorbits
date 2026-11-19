# AI-assisted Focus choices: phone integration

Requires the already-deployed `orbit-coach` function, JWT verification ON and the
existing OPENAI_API_KEY/AI quota SQL. No new secrets or migrations in this step.

Focus → explicitly consent → Find a focus with AI. Server computes patterns from
owner-scoped data, then AI selects/orders up to three existing candidate IDs and
asks gentle observational questions. Cards display server-calculated counts,
coverage and high/low/in-range fractions, separately from the model's question.

Choose this focus prefills the kind/window. User still writes their own experiment
and explicitly starts it. A fresh cloud read freezes the baseline, with >=3 covered
windows required for an AI-origin focus. Choices expire after 15 minutes. Editing
kind/window converts it to a custom focus. A current focus must be finished before
requesting new choices. Manual observation is always available without calling AI.

Insufficient coverage, stale data, invalid output, quota and network errors do not
invent cards or silently choose a focus. Each request clears consent afterward.
Only consent:true goes in the browser request; no readings/notes/prompts supplied.
Cards live in memory only and clear on logout. A chosen pattern ID is saved with
the account-scoped local plan; no model prose or raw traces are added to storage.

This is NOT a conversational follow-up coach. Daily check-ins remain explicitly
guided; AI follow-up, persisted cloud plans, PWA session/passkey/push are pending.
The host remains owner-private; no authentication or audience changes were made.

Mocked tests: consent gate, no automatic calls, insufficient data, validated cards,
selection→baseline→plan, active focus gating, malformed output, logout clearing.
Live model/real-data correctness remains the user's first signed-in test. A new
cloud archive may need several completed days before any candidate qualifies.
