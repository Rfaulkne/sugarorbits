# Pi setup log

## Hardware and display — confirmed 2026-09-18

Raspberry Pi 4B, 2GB RAM; Waveshare 3.4-inch round 800x800 DSI display; 64GB microSD; official 5.1V/3A supply. Debian 13 (Trixie), kernel 6.18.50+rpt-rpi-v8.

SSH works as `rob@sugarorbits.local`. The screen showed the orange/yellow mountain desktop after configuring the display. Touch, kiosk startup, app operation and backlight sleep are not yet verified.

Screen selector remains I2C-0. Working `/boot/firmware/config.txt` settings:

```ini
display_auto_detect=0
# Existing graphics overlay stays enabled:
dtoverlay=vc4-kms-v3d

[all]
dtoverlay=vc4-kms-dsi-waveshare-panel,3_4_inch
```

Use these settings for this confirmed board revision. Do not substitute the panel-v2 overlay based only on the product name. Power down and unplug before changing wiring or selector settings.

## App installation (pending physical verification)

```bash
sudo apt update
sudo apt install -y git python3-venv python3-pip
git clone https://github.com/Rfaulkne/sugarorbits.git
cd sugarorbits
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp -n .env.example .env
chmod 600 .env
nano .env
```

Enter the Dexcom publisher credentials locally, with region `ous` for Germany. Keep HOST=127.0.0.1 for the on-device browser. Never paste credentials into chat, commits or issues.

Start manually for the first check:

```bash
.venv/bin/python app.py
```

Open http://127.0.0.1:8787 in the Pi browser. Automatic startup and screen sleep remain follow-up work; closing this foreground process stops collection.

## Version policy

VERSION and CHANGELOG.md identify each baseline. Keep experimental visual changes separate until checked on hardware. The initial application code matches the September 14 archive; only repository documentation and ignore rules were added. The proposed 28-day retention, context tags, and tap-to-wake logic are not implemented in this baseline.
