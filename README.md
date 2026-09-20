# Sugar Orbits

**Using the installed Pi? See the [PowerShell command guide](POWERSHELL_README.md)** for connecting, updating, restarting, screen controls and safe shutdown.

Building the round unit or designing its enclosure? See the **[hardware BOM and mechanical references](docs/HARDWARE_BOM.md)**.

Sugar Orbits turns four rolling weeks of personal Dexcom G7 readings into
artistic seven-day radial glucose portraits. Each orbit is one day, time runs
clockwise, and the glucose curve deforms the ring. The Trends view reveals
recurring high and low windows while preserving the same orbital visual language.

The primary interface target is now the Waveshare 3.4-inch, 800×800 round DSI
touch display on a Raspberry Pi 4. The PC and iPhone layouts remain useful for
setup and development previews.

This branch reads real personal data from the Dexcom Share service through the
community `pydexcom` package. It does not require Dexcom Developer production
access. It is a private, read-only visualization—not an alert, dosing, treatment,
or remote-monitoring system.

## Current data flow

```text
Dexcom G7 → Dexcom G7 phone app → Dexcom Share → Sugar Orbits
```

The phone must continue uploading readings to Dexcom Share. Share exposes at
most the latest 24 hours in one request, so Sugar Orbits stores every reading in
a local SQLite archive and gradually builds its history. The archive retains 35
days: four selectable seven-day portraits plus the preceding week needed for a
week-over-week average comparison.

## Features

- Personal Dexcom G7 readings via Dexcom Share
- Germany/non-US `ous` region support
- Automatic five-minute synchronization
- Immediate startup synchronization before the interface loads
- Once-per-minute display refresh from the local cache, including on wake/return
- Startup backfill of the latest available 24 hours
- Deduplicated 35-day SQLite archive (well below 10 MB at normal CGM density)
- Four selectable weeks, each rendered as seven organic daily orbits
- Three-finger pinch inward for older weeks and outward for newer weeks
- One-finger touch/drag or mouse hover selects the nearest day
- Center weekly average, daily time-in-range selection, and previous-week direction
- Radial recurring-trend view
- Smooth desktop ring hover
- iPhone bottom day dial and horizontal view switching
- Dedicated circular-safe 800×800 Raspberry Pi layout
- Private LAN preview and optional access-code protection
- No browser exposure of the Dexcom username or password

## Before starting

In the Dexcom G7 app, enable **Connections → Share**. Dexcom Share must have at
least one active follower. Sugar Orbits uses the credentials of the account
publishing the readings, not the follower account.

For Germany, keep the region set to `ous`.

## Windows setup

Extract the project, open PowerShell in its folder, then run:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

Add your private Dexcom credentials:

```text
DEXCOM_SHARE_USERNAME=your Dexcom email, username, or phone number
DEXCOM_SHARE_PASSWORD=your Dexcom password
DEXCOM_SHARE_REGION=ous
```

Do not put quotation marks around the values. Save the file and run:

```powershell
.\.venv\Scripts\python.exe app.py
```

Open <http://127.0.0.1:8787>.

If the virtual environment already exists, still run the `pip install` command
once because this branch adds `pydexcom`.

## iPhone preview on the same Wi-Fi

After `.env` is configured, double-click:

```text
start-iphone-preview.cmd
```

The launcher prints the address to open in iPhone Safari. Keep the PowerShell
window open and allow Python on **Private networks only** if Windows Firewall
asks. Stop the preview with `Ctrl+C`.

## Mac setup

With Python 3 installed, double-click `start-iphone-preview.command`. It creates
the environment, installs requirements, creates `.env` if needed, and prints the
local address to open on an iPhone using the same Wi-Fi.

## Configuration reference

| Variable | Purpose | Default |
| --- | --- | --- |
| `DEXCOM_SHARE_USERNAME` | Publisher login used by the G7 app | blank |
| `DEXCOM_SHARE_ACCOUNT_ID` | Advanced alternative to username | blank |
| `DEXCOM_SHARE_PASSWORD` | Publisher password | blank |
| `DEXCOM_SHARE_REGION` | `us`, `ous`, or `jp` | `ous` |
| `DEXCOM_POLL_SECONDS` | Background update interval | `300` |
| `DATA_DIR` | Rolling SQLite archive directory | `.data` |
| `HOST` | Web server bind address | `127.0.0.1` |
| `PORT` | Web server port | `8787` |
| `APP_ACCESS_CODE` | Required for internet-hosted private use | blank |
| `APP_SESSION_SECRET` | Signs private access sessions | blank |

Fill exactly one of `DEXCOM_SHARE_USERNAME` or `DEXCOM_SHARE_ACCOUNT_ID`.

## Privacy and reliability

- `.env` and `.data` are excluded from the project archive and source control.
- The password remains server-side and never enters the browser interface.
- Use the LAN preview only on trusted private Wi-Fi.
- The displayed timestamp makes stale readings visible.
- Dexcom Share and `pydexcom` are not the official Dexcom Developer API and may
  change without notice.
- Never use Sugar Orbits as the sole source for glucose alarms or treatment
  decisions. Use the Dexcom G7 app and prescribed medical devices for those.

## Raspberry Pi round-display direction

The Pi runs the same Python collector and browser interface used by the confirmed
PC build. At an 800×800 viewport, the interface automatically enters its round
kiosk layout: persistent controls move into the circular safe area, external
footer information disappears, direct touch selects daily rings, and a
three-finger pinch changes the visible week.

The first start can retrieve only the latest 24 hours from Dexcom Share. Older
weekly portraits therefore become available as the Pi remains online and collects
readings. The 64 GB card has vastly more capacity than this archive requires.
