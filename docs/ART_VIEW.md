# Art face — v0.3.0

The round display and phone start with seven gradient data traces and no visible labels, numbers, buttons, or guide circles. Swipe left for the existing seven-day detail view, left again for trends, and right to return. As of v0.3.1, views wrap in either direction. On desktop, use the Art button or left/right arrow keys.

The palette is reused from the September 16 spectrum prototype. Its blue/cyan, pale neutral, violet, coral and orange stops interpolate by mmol/L, not clock position. It is expressive rather than a binary high/low legend; the unchanged detail view retains blue/orange threshold segments. Art uses the same shaped data geometry and gap boundaries as detail. It does not fabricate seven full rings when fewer days exist.

The reveal lasts under two seconds, with staggered ring movement and opacity, and then stops. Reduced-motion mode skips it. A pointer-down after two minutes without pointer activity replays it when already in Art. This is an idle-touch heuristic; there is no direct display-power event from labwc to the web page. Confirm that the actual screen wake delivers that touch. The selected mode is retained during screen sleep; waking from detail does not force Art.

No text or sync alerts appear in Art. Swipe to detail to check the data status or retry a failed sync. Cached data can remain on screen while offline. If initial live loading fails with no data loaded, the app falls back to the visibly labelled sample/detail view.

Slower swipes and mouse-emulated touch are supported in v0.3.1. The stable stage captures each swipe even if the data SVG is refreshed.

## Install on the existing Pi

```bash
cd ~/sugarorbits
git pull --ff-only
sudo reboot
```

Credentials, local glucose history, systemd service and desktop autostart stay on the Pi. This revision does not change collection or system sleep settings.

## Revision archives

- archive/v0.1.1-pi-verified: confirmed 24-hour backfill baseline.
- archive/v0.2.0-round-swipe: larger rings and two-view swipes.
- archive/v0.3.0-art-face: this art-view prototype.

Each archive branch points to a named revision; do not advance archive branches when developing new versions. The GitHub branch menu allows browsing and downloading each version. Git commits retain the exact history as well.

## Validation

Run `python -m unittest discover -s tests` and `node tests/test_art.cjs`.
Physical Pi checks pending: appearance at 800x800, no ring clipping, responsiveness with seven full days, swipe navigation, and reveal on tap-to-wake. Browser binary installation failed in development, so no rendered browser screenshot has been verified.
