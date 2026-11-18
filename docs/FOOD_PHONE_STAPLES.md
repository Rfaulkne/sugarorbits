# Phone Food Genie: scan, text and staples

Frontend only. Reuses the already-deployed `food-genie` function without a new SQL
migration, new secret or changes to the Pi.

- Scan now requests the rear camera, captures a still and closes all camera tracks.
  Capture alone never sends a network request. The user confirms consent and taps
  Identify food with AI before a resized JPEG is sent. Camera/file permission or
  format failures retain the alternative photo-picker and text entry routes.
- Say / type opens food and portion fields without a photo. Voice uses the normal
  iPhone keyboard Dictation button; there is no separate audio upload/recorder.
- Staples start with editable rice (cooked) / bread templates. Save food text and
  a usual portion, max eight. No estimated carbs are cached or called verified.
- Staples use account-ID-scoped localStorage, not Supabase; they remain on that
  browser across logouts, hidden from other signed-in accounts. Edit removes them;
  clearing website data also removes them. They do not sync between devices.
- AI drafts/photos remain in memory, cleared on sign-out. Reload still requires
  sign-in. This is not yet the persistent-session/PWA/push release.
- Coach, cloud Dexcom collector and notifications remain pending. No credentials
  or medical data have been migrated from the Pi.

Tests use mocks only: authentication, logging/Undo, direct entry, favourites,
camera fallback/capture/track cleanup/cancel race, consent and estimates. Actual
iPhone permissions, camera rendering and live AI output still require user QA.
