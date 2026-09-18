# Pi setup log

## Hardware and display — confirmed 2026-09-18

Raspberry Pi 4B, 2GB RAM; Waveshare 3.4-inch round 800x800 DSI display; 64GB microSD; official 5.1V/3A supply. Debian 13 (Trixie), kernel 6.18.50+rpt-rpi-v8.

SSH works as `rob@sugarorbits.local`. The screen showed the orange/yellow mountain desktop after configuring the display. The user subsequently confirmed the app displays correctly, touch works, and the kiosk returns automatically after reboot. A 15-second screen-off/tap-to-wake test succeeded. The permanent 120-second timer was configured and the Pi rebooted; final confirmation of that interval is pending.

Screen selector remains I2C-0. Working `/boot/firmware/config.txt` settings:

```ini
display_auto_detect=0
# Existing graphics overlay stays enabled:
dtoverlay=vc4-kms-v3d

[all]
dtoverlay=vc4-kms-dsi-waveshare-panel,3_4_inch
```

Use these settings for this confirmed board revision. Do not substitute the panel-v2 overlay based only on the product name. Power down and unplug before changing wiring or selector settings.

## App installation — completed

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

Open http://127.0.0.1:8787 in the Pi browser. Closing this manual foreground process stops collection; the service below replaces manual startup.

## Version policy

VERSION and CHANGELOG.md identify each baseline. Keep experimental visual changes separate until checked on hardware. The initial application code matches the September 14 archive; only repository documentation and ignore rules were added. The proposed 28-day retention and context tags are not implemented in this baseline. Screen sleep/wake is configured at the desktop level as described below.

## Background service — reboot tested

Installed at `/etc/systemd/system/sugar-orbits.service`:

```ini
[Unit]
Description=Sugar Orbits glucose collector and web app
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=rob
WorkingDirectory=/home/rob/sugarorbits
ExecStart=/home/rob/sugarorbits/.venv/bin/python /home/rob/sugarorbits/app.py
Restart=always
RestartSec=10
UMask=0077

[Install]
WantedBy=multi-user.target
```

Enabled with `sudo systemctl daemon-reload` and `sudo systemctl enable sugar-orbits`, then rebooted. The user confirmed the app returned automatically. The PC and SSH sessions are no longer needed to keep it running. Collection requires Pi power and internet access, and a working Dexcom Share feed. The startup banner alone does not verify a successful data fetch.

## Browser autostart — reboot tested

Desktop is labwc, with graphical boot and a working desktop session. The initially absent `~/.config/labwc/autostart` was created by copying `/etc/xdg/labwc/autostart`, preserving its startup commands. The following was appended once:

```bash
# Sugar Orbits: wait for the local app, then open the round-screen kiosk.
(
    until /home/rob/sugarorbits/.venv/bin/python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8787", timeout=2)' >/dev/null 2>&1; do
        sleep 2
    done
    chromium --ozone-platform=wayland --password-store=basic --user-data-dir=/home/rob/.config/sugar-orbits-kiosk --kiosk --no-first-run http://127.0.0.1:8787
) > /home/rob/.config/sugar-orbits-kiosk.log 2>&1 &
```

The dedicated browser profile and basic password store avoid the desktop keyring prompt. Dexcom credentials remain in the server environment file; do not save passwords in this kiosk browser. Paths above are specific to user `rob`.

## Screen sleep and wake — short test passed

Installed tools: `/usr/bin/swayidle`, `/usr/bin/wlopm`. Wayland socket: `/run/user/1000/wayland-0`. Output: `DSI-1`. Backlight device: `/sys/class/backlight/10-0045`. No existing swayidle process was found before setup.

A manual 15-second timeout switched off the display; the user confirmed touch woke it. That foreground test was stopped before the persistent configuration. The following was appended once to the same labwc autostart file:

```bash
# Sleep the screen after two minutes; wake on touch.
swayidle -w timeout 120 'wlopm --off DSI-1' resume 'wlopm --on DSI-1' &
```

Pi rebooted after saving. **Pending:** user confirmation that the permanent two-minute timeout works after boot. This turns off the display output, not the Pi or collector. Wake-touch consumption is not implemented: the first tap may also interact with the app. Energy consumption has not been measured.

## Maintenance

Read status: `systemctl status sugar-orbits --no-pager`.
Read recent app logs locally: `journalctl -u sugar-orbits -n 50 --no-pager` (check for private information before sharing).
After an intentional code update: `sudo systemctl restart sugar-orbits`.

These instructions record the configuration applied manually to the Pi. GitHub does not automatically synchronize `/etc/systemd/system/`, the desktop autostart file, credentials, browser profiles, or glucose history. Do not append duplicate startup blocks when repeating setup.
