# Sugar Orbits — Low-Cost E-Paper Edition

> Status: proposed product direction / not yet implemented

The Low-Cost E-Paper Edition is a separate, non-interactive version of Sugar
Orbits intended to behave like a small piece of generative wall art. It shows
only the current orbit composition, refreshes automatically as new Dexcom data
arrives, and removes the touchscreen, browser kiosk, animation, and desktop
environment required by the round-display edition.

This edition does not replace the existing 3.4-inch round touchscreen build.

## Design intent

- Always-visible glucose portrait rather than an interactive dashboard
- No touch, menus, animation, numbers, alarms, or treatment controls
- Quiet monochrome presentation using black, white, and four grey levels
- Automatic Dexcom Share synchronization every five minutes
- Last valid portrait remains visible during Wi-Fi loss, shutdown, or power loss
- Lower component cost, heat, power use, and software complexity
- Flat enclosure suitable for a wall, shelf, or small picture-frame format

## Recommended display

**Waveshare 4.2-inch black-and-white e-Paper Module**

| Property | Specification |
| --- | --- |
| Resolution | 400 × 300 pixels |
| Visible area | 84.8 × 63.6 mm |
| Outer dimensions | 103.0 × 78.5 mm |
| Colour | Black, white, four grey levels |
| Interface | 3-wire or 4-wire SPI |
| Full refresh | Approximately 5 seconds |
| Partial refresh | Approximately 0.4 seconds |
| Typical refresh power | 26.4 mW |
| Standby current | Less than 0.01 µA |
| Included connection | PH2.0 8-pin, 20 cm cable |
| Reference part | Waveshare 4.2inch e-Paper Module / EINKM-42 |
| Indicative German price | Approximately €28.90 |

Product reference:
[BerryBase — Waveshare 4.2-inch 400×300 ePaper Module](https://www.berrybase.de/4.2-400-300-epaper-display-modul-mit-spi-interface)

Availability and pricing should be checked before ordering.

## Proposed visual treatment

The 400 × 300 canvas can hold an orbit composition approximately 286–292
pixels in diameter.

- Seven daily glucose curves remain stationary.
- The current day is rendered darkest.
- Earlier days step progressively into lighter greys.
- The newest valid sample may be marked with one small dark orbital point.
- A discreet sync-status mark can distinguish current, offline, and stale data
  without displaying technical text.
- The background is the natural white of the e-paper panel.
- Orange and blue event colours are intentionally omitted.

The design should preserve the organic deformation of the existing Sugar
Orbits home view rather than reduce it to a conventional chart.

## Data and rendering architecture

```text
Dexcom G7
    ↓
Dexcom phone app and Share
    ↓
Python collector on Raspberry Pi
    ↓
35-day SQLite archive
    ↓
400×300 Pillow/SVG renderer
    ↓
SPI e-paper driver
    ↓
Static Sugar Orbits portrait
```

The e-paper edition does not need Chromium, Wayland, Labwc, or an animated web
interface. A small system service can collect readings, render the current
frame, update the panel, and return to idle.

## Refresh strategy

1. Synchronize Dexcom Share every five minutes.
2. If a new reading is available, render a new 400 × 300 frame.
3. Use a partial refresh for normal five-minute updates.
4. Perform a complete refresh periodically—initial proposal: after every 12
   partial updates—to clear accumulated ghosting.
5. Preserve the previous image if synchronization or rendering fails.
6. After reboot, show the stored image immediately, then replace it only after a
   successful synchronization.

The exact partial/full refresh schedule must be validated on the selected panel.
Repeated partial refreshes can leave residual images, while a full refresh
briefly flashes the complete display.

## Hardware routes

### Reuse the existing Raspberry Pi 4

This is the quickest prototype route. Only the e-paper module and enclosure are
new. Removing Chromium and the desktop kiosk should substantially reduce CPU
activity and heat.

### Future low-cost production route

Use a Raspberry Pi Zero 2 W for a smaller, cooler and less expensive dedicated
unit. The existing Python collector and SQLite history can remain, while the
display layer is replaced by the e-paper renderer.

Indicative per-unit budget:

| Component | Expected range |
| --- | ---: |
| Raspberry Pi Zero 2 W | €18–€25 |
| 4.2-inch e-paper module | €29–€35 |
| 16–32 GB microSD card | €6–€10 |
| 5 V power supply | €8–€12 |
| Enclosure and hardware | €5–€15 |
| **Estimated complete unit** | **€66–€97** |

These figures are planning estimates rather than a purchasing quotation.

## Physical controls

The normal display has no controls. Configuration and maintenance occur over
Wi-Fi using SSH.

A concealed rear pushbutton is recommended for safe shutdown before unplugging.
An optional second button could force synchronization or display a temporary
status frame, but neither is required for the first prototype.

## Lighting and placement

E-paper reflects room light and has no backlight. It remains easy to read in
daylight and normally lit rooms, but it will not be visible in darkness. A
frontlight would add cost and power consumption and is not part of the initial
low-cost design.

## Limitations

- No touch interaction, daily selection, swiping, pinching, or Trends page
- No animation or moving orbital points
- No orange/blue high-and-low event colours
- Slow visible refresh compared with LCD
- Periodic full-refresh flashing
- Lower resolution than the 800 × 800 round display
- E-paper display savings do not eliminate the Raspberry Pi's own power use
- Dexcom Share remains an unofficial, read-only data source and may change

Sugar Orbits remains a reflective visualization, not a glucose alarm, dosing
tool, treatment system, or replacement for the Dexcom G7 app.

## Implementation plan

1. Add a standalone 400 × 300 orbit renderer using recorded test data.
2. Produce still-image previews for approval before buying hardware.
3. Add the Waveshare Python driver behind a display abstraction.
4. Test partial refresh, full refresh, ghosting, and cold-boot recovery.
5. Add a headless systemd service and remove the graphical kiosk dependency.
6. Measure Pi 4 temperature and power consumption.
7. Validate a Pi Zero 2 W build.
8. Design a flat enclosure with rear access to power and safe shutdown.
