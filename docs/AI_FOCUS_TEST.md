# Semi-AI Focus: first server test

This prepares the server; deploying it does not change the current phone UI yet.
Deploy NEW Edge Function `orbit-coach`, paste ALL of `index.ts`, leave JWT
verification ON. It reads the already-saved OPENAI_API_KEY. No new SQL or keys.
Do not paste handler.js alone: index.ts includes the tested calculation module.
The phone suggestion button/selection integration is the next deployment step.

The server validates the caller's JWT, reads only that user's RLS-protected
glucose and latest 20 activity tags and recomputes candidate patterns. It never
trusts pattern counts from the client. Minimum: three covered/affected days, or
three qualifying tagged activity windows. Coverage/timezone/DST logic is the same
as the phone. A stale feed (>24h) or no qualifying pattern stops BEFORE an AI call.

Only candidate time windows and numerical aggregates go to OpenAI, after per-call
consent. No raw glucose traces, event timestamps, notes, user IDs, credentials or
habit text. Request consent via POST `{ "consent": true }`; no other body keys.

AI selects/orders up to three known candidate IDs and writes a gentle question.
It cannot invent candidate windows, alter the displayed counts or select a focus
for the user. Statistics in the response come from deterministic calculations,
not model output. Duplicate/unknown IDs, medical/causal language or model-supplied
numbers in questions cause the draft to be discarded. This prompt/filter layer
is not a clinically validated classifier and needs adversarial/live review.

Food Genie and Focus share the existing per-user 20 requests/day, 10s cooldown
quota. Failed upstream requests consume a slot. Model: gpt-4.1-mini, max 700 output
tokens, store:false; provider retention policies still apply. No automatic calls.

The existing seven-day Focus is still on-device guided check-ins. This server is
only suggestion selection, not an open-ended conversational coach, dosing advice,
push system or cloud plan store. Actual AI follow-up conversation is another phase.

Build: `node tests/build_coach_function.cjs`. Tests use synthetic data and mocked
providers only. Live project RLS, real-data mapping and model output need testing.
