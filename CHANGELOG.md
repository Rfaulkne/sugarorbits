# Sugar Orbits version history

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
