# Sugar Orbits version history

## 0.5.0 — 2026-09-20

- Add a screen-only safe shutdown flow: hold the centered title, then complete a separate hold-to-confirm action.
- Show a clear wait-for-black-screen message before the Pi powers off. Short taps and incomplete holds cancel safely.
- Restrict the power endpoint to the Pi's loopback browser and require an explicit private environment flag.
- Add a one-time installer granting the app user password-free access to only `/usr/bin/systemctl poweroff`.
- Keep swipe navigation and glucose calculations unchanged.
- Preserve archive/v0.4.0-breathing-title before this change.

## 0.4.0 — 2026-09-19

- Art rings breathe together from 100% to 103% scale over a ten-second cycle. The center title stays still.
- Pause breathing after two minutes of no pointer/keyboard interaction, when the page is hidden, or outside Art. Respect reduced motion. This uses browser idle timing, not a hardware power-state signal.
- Clip wider gradient colour strokes through continuous 1.9px data-curve silhouettes to reduce segmented edge artifacts without changing data geometry.
- Place Sugar Orbits in the middle of Art and above the central detail values. Remove the top brand and bottom view buttons; swipes, mouse drags and arrow keys navigate.
- Preserve archive/v0.3.1-swipe-verified before the visual changes.
- Trend calculations and glucose collection unchanged.
- Validation: 10 Python tests, JavaScript syntax and art geometry/gap/gesture checks pass. Physical display rendering, animation performance and sleep timing await user confirmation.

## 0.3.1 — 2026-09-19

- Fix swipe robustness: capture the pointer on the stable stage and keep ring interaction there across SVG refreshes.
- Accept left-button drag events from mouse-emulating kiosk touch drivers as well as native touch.
- Allow slower swipes (up to two seconds, minimum 40px); wrap between the three views in either direction so Art is never a dead end.
- Art geometry, native/mouse-like gestures, slower swipes, cancellation, multi-touch and Python checks pass. Physical Pi verification pending; exact cause on the device was not directly observed.

## 0.3.0 — 2026-09-19

- Add a text-free art face as the default on round displays and phones. Desktop starts in detail with an Art button.
- Restore the spectrum prototype palette, driven by glucose values along the same seven daily profiles; missing intervals remain gaps.
- Swipe left through Art → Seven days → Trends; swipe right to return. Multi-touch history stays separate. Arrow keys provide desktop navigation.
- Add a brief staggered reveal on initial art load, entering Art, and a touch after two minutes without interaction. No continuous art animation; reduced-motion preference is respected.
- Error/status messages remain accessible in the detail views. Startup without data falls back to the labelled sample/detail view instead of displaying sample data as unlabeled art.
- Preserve v0.2.0 at archive/v0.2.0-round-swipe.
- Validation: 10 Python tests; JavaScript syntax; art path geometry, missing-data gaps, palette and three-view gesture checks pass. Browser installation was unavailable in the development environment; visual quality, Pi performance, and wake reveal still need physical-device confirmation.

## 0.2.0 — 2026-09-19

- Enable one-finger horizontal swipes on the round Pi display: left opens average/trends, right returns to seven days.
- Cancel view swiping when a second finger joins so three-finger history navigation remains separate.
- Enlarge the round display orbit graphic, center text and time labels to 115% in both views. Fixed top/bottom controls stay in their circular safe area.
- Refresh the static asset cache version.
- Preserve the previous working revision at archive/v0.1.1-pi-verified.
- User confirmed v0.1.1 backfills the last 24 hours on the Pi.
- JavaScript syntax and gesture regression checks passed; physical screen validation pending.

## 0.1.1 — 2026-09-19

- Reconcile the complete available Dexcom Share 24-hour window (up to 288 readings) on startup and every scheduled/manual sync. A recent cached reading no longer prevents filling earlier holes.
- Retry failed background sync after 60 seconds, including boot-time Wi-Fi failures; successful syncs retain the configured interval.
- Timestamp-based deduplication and existing archived history are preserved. The seven-day display continues splitting readings into calendar-day rings.
- Validation: 10 unit tests pass, including restart with recent cached data, older gap backfill, deduplication and boot failure retry. Physical Pi/live-account verification pending.
- User confirmed permanent two-minute screen sleep and tap-to-wake on September 18.

## 0.1.0-pi-baseline — 2026-09-18

Imported the preserved 2026-09-14 Pi round/week-history app without application code changes.
Source archive: sugar-orbits-pi-round-week-history-2026-09-14.zip
SHA-256: 7df3371d9a649af28450542ca6bcacb40bd4270253f86e26c5a8cf331e8b85fc

- Seven-day ring view and four-week navigation for the round display.
- Dexcom Share collection and local history.
- Current implementation retains 35 days, not the proposed 28 days.
- Pi 4 / round screen desktop confirmed working on 2026-09-18; app display, touch, and automatic startup subsequently confirmed working.
- The September 16 spectrum prototype is separate and is not part of this baseline.

Future changes should record their purpose, validation, and limitations here. Never commit credentials or glucose records.

## Pi deployment log — 2026-09-18

- Documented installed systemd collector/web service and labwc Chromium autostart.
- Recorded dedicated kiosk profile to avoid the desktop keyring prompt.
- Confirmed automatic startup after reboot and successful 15-second sleep/touch-wake test.
- Saved 120-second sleep timer and rebooted; final timeout confirmation pending.
- No application code changes in this documentation update; version remains 0.1.0-pi-baseline.
