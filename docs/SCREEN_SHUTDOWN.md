# Screen-only safe shutdown

Sugar Orbits can safely power off the Raspberry Pi from its round touchscreen.

## Install once

After updating the repository on the Pi:

```bash
cd ~/sugarorbits
sudo bash scripts/install-power-control.sh
sudo reboot
```

The installer:

- enables the shutdown control in the Pi's private `.env` file;
- grants the app user password-free access to only `/usr/bin/systemctl poweroff`;
- validates the sudo rule before installing it; and
- restarts the Sugar Orbits service.

It does not expose a general root shell. The web endpoint rejects requests that do not originate from the Pi itself and requires a same-origin confirmation header, preventing an unrelated web page from issuing the action as a simple cross-site request.

## Use it

1. Press and hold the centered **Sugar Orbits** title for about two seconds.
2. On the confirmation screen, press and hold **hold to power off** until the circle fills.
3. Wait for the round display to go black and for activity to stop, then wait about 30 seconds before unplugging power.

A short tap does nothing. Releasing either hold early cancels it. Swipe navigation is unchanged.

## Remove it

Disable `ALLOW_SYSTEM_SHUTDOWN` in `.env`, remove the narrow sudo rule, and restart the service:

```bash
cd ~/sugarorbits
sed -i 's/^ALLOW_SYSTEM_SHUTDOWN=.*/ALLOW_SYSTEM_SHUTDOWN=false/' .env
sudo rm /etc/sudoers.d/sugar-orbits-poweroff
sudo systemctl restart sugar-orbits
```
