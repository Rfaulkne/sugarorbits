# Food Genie server pilot

The stored OPENAI_API_KEY alone does not enable the phone UI. This change prepares
the server only. Keep the Pi and existing phone logging unchanged while deploying.

1. In SQL Editor, run `supabase/migrations/202611180001_food_quota.sql` once.
   This adds atomic per-account rate limits: 20 requests/day (UTC), 10s cooldown.
   Failed upstream calls consume a slot too. Two calls are normally used per meal.
   Quotas are not a guaranteed dollar budget. Disable public/anonymous signup.
2. Edge Functions → Deploy a new function → Via Editor. Name: `food-genie`.
3. Replace the template with **all** of `supabase/functions/food-genie/index.ts`.
   Keep JWT verification enabled. The function also checks the user's JWT with
   Supabase Auth; publishable keys alone are never accepted as user sessions.
4. Deploy. Do not insert the API secret into the editor; it reads OPENAI_API_KEY
   from the secret you already saved. Model used: `gpt-4.1-mini`.
5. Report deployment success before connecting the phone UI. Do not test using
   service-role/secret keys. Live signed-in/iPhone/isolation QA is still required.

Server accepts only the existing private phone site's exact origin. It checks
consent, caps request size, limits model output, validates JSON, and never logs or
stores photos or food descriptions. OpenAI provider retention policies still
apply; store:false is not a promise of zero retention. Photos are sent only for
identification; confirmed food text and portions are used in the estimate step.

No image-based quantity guessing, confirmed-carb logging, dosing advice or coach
is enabled here. Food estimates can be substantially wrong. Coach awaits actual
Pi summaries and its own validated pattern engine.

The quota table retains one current counter per account (deleted with the account),
not a request history. No service-role key is required by this function.
