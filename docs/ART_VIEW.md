# Art face — v0.4.0

The round display and phone start with seven faint-grey data traces, one neutral orbiting dot per trace, and a simple centered Sugar Orbits title, without numbers, buttons, or guide circles. Swipe left for the existing seven-day detail view, left again for trends, and right to return. As of v0.3.1, views wrap in either direction. On desktop, use horizontal mouse drags or left/right arrow keys.

The home face is deliberately monochrome; the unchanged detail view retains blue/orange threshold segments. Art uses the same shaped data geometry and gap boundaries as detail. It does not fabricate seven full rings when fewer days exist.

The reveal is a staggered fade with no scaling or rotation. Afterwards, each small neutral dot moves clockwise along its day's longest uninterrupted real-data path, with phase and speed staggered between days. Choosing one uninterrupted section prevents a dot from crossing a missing-data gap; on an unusually incomplete day it may cover only part of the clock. Reduced-motion mode keeps the dots stationary. A pointer-down after two minutes without pointer activity replays the reveal when already in Art. This is an idle-touch heuristic; there is no direct display-power event from labwc to the web page. The selected mode is retained during screen sleep; waking from detail does not force Art.

Only the Sugar Orbits title appears in Art; sync alerts remain in detail. Swipe to detail to check the data status or retry a failed sync. Cached data can remain on screen while offline. If initial live loading fails with no data loaded, the app falls back to the visibly labelled sample/detail view.

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

## v0.4.0 visual changes

The title sits at the center on Art and above the numeric readout on detail/trends. The old top brand and bottom view toggles were removed. Swipe navigation remains unchanged from the verified v0.3.1 implementation.

Colour segments now paint through one continuous stroke mask per uninterrupted data chunk. The visible stroke remains 1.9 SVG units wide; the underlying colour strokes are wider to avoid cap-shaped seams. Glucose values and path geometry have not been changed. Confirm actual antialiasing and frame rate on the Pi.

The orbiting dots pause after 120 seconds without pointer/keyboard input, outside Art, and when the browser document is hidden. Input resumes them. This matches the configured screen-idle duration but does not read labwc display power state directly. Reduced motion disables the animation entirely. No measured energy-saving claim is made.

Archives: archive/v0.3.1-swipe-verified and archive/v0.4.0-breathing-title.

## v0.7.0 wall and reference motion

Art uses the staggered orbital tide described above. In Trends, the 3.9 and 10.0 mmol/L reference profiles have brighter static purple strokes plus small orbiting highlights. These highlights mark the target-range boundaries; they do not represent glucose events. Reduced-motion mode leaves the reference profiles visible and stops the highlights.

On Seven days, a selected day shows its time in range. During press-and-drag probing, the recorded glucose value and timestamp remain primary while that day's time in range stays visible beneath them. Opening screen shutdown requires a stationary three-second hold; movement beyond 14 pixels cancels it.

Archive: archive/v0.6.0-touch-probe.

## v0.8.0 stationary Art geometry

Art no longer scales or breathes after its initial reveal. Its base glucose profiles remain fully visible and fixed. A normalized SVG path mask reveals a wider duplicate of the same colour gradient along a short moving section, producing the travelling trim without substituting a generic highlight colour.

Archive: archive/v0.7.0-orbital-tide.

## v0.9.0 monochrome orbit face

Art now draws each uninterrupted glucose section directly as a fixed, faint-grey path. Exactly one dot is rendered per day using a very short round-capped dash on the longest available section. CSS dash-offset animation moves it without transforming the underlying curve.

Archive: archive/v0.8.0-moving-trims.

## v0.9.1 center statistics

When all detailed rings are visible, the center keeps 7-day average glucose as its primary number and adds the displayed week's time in range beneath it. The lower line retains the previous-week comparison when available.

The Trends default center shows the percentage of readings below 3.9 mmol/L and above 10.0 mmol/L for the displayed week. Values exactly at 3.9 or 10.0 count as in range. Touching a recurring colour window temporarily replaces these totals with that pattern's recurrence detail.

Archive: archive/v0.9.0-monochrome-orbits.
