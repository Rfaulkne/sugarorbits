# PowerShell guide — Sugar Orbits on the Raspberry Pi

For the existing Pi: username **rob**, hostname **sugarorbits.local**, app folder **/home/rob/sugarorbits**.

## Which window do I use?

Open **PowerShell / Windows Terminal** on your Windows PC. The PC and Pi should be on the same home network.

| Prompt you see | Where commands run |
| --- | --- |
| `PS C:\Users\rfaul>` | Your Windows PC |
| `rob@sugarorbits:~ $` | Your Pi, connected through SSH |
| `rob@sugarorbits:~/sugarorbits $` | Your Pi, inside the app folder |

Copy only the command, not the prompt or surrounding quotes. Run commands one at a time. If one fails, stop and inspect the error before continuing.

## Connect to the Pi

Run in **Windows PowerShell**:

```powershell
ssh rob@sugarorbits.local
```

Enter your **Pi login password**, not your Dexcom password. No characters appear while typing the password; press Enter when finished.

On the first connection, SSH asks whether to trust the host. Once you have checked that this is your Pi, type `yes`. If connecting immediately after power-on, allow about two minutes for boot and Wi-Fi.

If you already see `rob@sugarorbits:~ $`, you are connected and can skip this step.

## Safely shut down before unplugging

Run in the **connected Pi terminal**:

```bash
sudo poweroff
```

SSH disconnects. Wait about **30 seconds**, until shutdown/activity has finished, before unplugging power. If the board is still visibly active, give it more time.

After shutdown, to turn it back on, disconnect and reconnect its power supply. Sugar Orbits starts automatically.

Do not use a Windows shutdown command: that would shut down the PC rather than the Pi.

## Restart the Pi

Run on the **Pi**:

```bash
sudo reboot
```

The SSH connection closes. Wait roughly two minutes for Sugar Orbits to return. Reconnect from PowerShell if you need more commands:

```powershell
ssh rob@sugarorbits.local
```

## Disconnect without stopping Sugar Orbits

Run in the **Pi terminal**:

```bash
exit
```

You can also close PowerShell and turn off your PC. The installed background service and kiosk continue running independently while the Pi has power and internet.

## Update Sugar Orbits from GitHub

Run on the **Pi**, one command at a time:

```bash
cd ~/sugarorbits
git status --short
git pull --ff-only
sudo reboot
```

If `git status --short` lists changes you did not expect, or `git pull` reports an error, stop before rebooting and ask for help. Do not force-reset or delete files to clear the error.

Reboot refreshes both the app service and Chromium. Your credentials and local glucose history are excluded from Git and remain on the Pi.

Only when an update specifically changes Python dependencies, run this after a successful pull and before rebooting:

```bash
.venv/bin/python -m pip install -r requirements.txt
```

## Check the installed version

Run on the **Pi**:

```bash
cd ~/sugarorbits
cat VERSION
git log -1 --oneline
```

Named revision archives are available in the [GitHub branch list](https://github.com/Rfaulkne/sugarorbits/branches). Use these for reviewing/downloading old revisions; ask for rollback instructions rather than deleting the app folder.

## Check whether the app is running

Run on the **Pi**:

```bash
systemctl status sugar-orbits --no-pager
```

Look for `active (running)`. This confirms the process is running, not necessarily that Dexcom authentication or the latest sync succeeded.

Check sync status:

```bash
curl -s http://127.0.0.1:8787/api/status
```

This shows status and timestamps rather than the complete glucose history. Inspect output before sharing it.

## Restart just the app service

Run on the **Pi**:

```bash
sudo systemctl restart sugar-orbits
```

The browser usually refreshes data within about one minute. This does not reload updated interface code in an already-open page; reboot after interface updates.

The service already starts automatically. Do not also run `python app.py` manually: a second copy can conflict on port 8787.

## Read recent logs

Run on the **Pi**:

```bash
journalctl -u sugar-orbits -n 50 --no-pager
```

To watch new messages as they arrive:

```bash
journalctl -u sugar-orbits -f
```

Press **Ctrl+C** to stop watching; the service keeps running. Review logs for private information before posting them.

Browser startup log:

```bash
tail -n 50 ~/.config/sugar-orbits-kiosk.log
```

## Screen sleep and wake

The screen sleeps after **two minutes** of inactivity. Tap to wake it. These were confirmed working on this Pi. Collection continues while the display is off.

Check display state from the **Pi terminal**:

```bash
XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 wlopm
```

Wake the display manually if necessary:

```bash
XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 wlopm --on DSI-1
```

Check the installed idle timer:

```bash
pgrep -a swayidle
```

These paths and output name match Rob's current setup. No need to rerun the sleep installation commands every time you connect.

## Check temperature, throttling and storage

Run on the **Pi**:

```bash
vcgencmd measure_temp
vcgencmd get_throttled
df -h /
```

The recorded reading was 56.4°C with `throttled=0x0`: no current or recorded undervoltage/throttling flags since boot. Keep airflow around the board.

For a live process view:

```bash
top
```

Press **q** to leave it.

## Edit Dexcom credentials privately

Only if your credentials need changing, run on the **Pi**:

```bash
cd ~/sugarorbits
nano .env
```

Save with **Ctrl+O**, **Enter**; exit with **Ctrl+X**. Then:

```bash
chmod 600 .env
sudo systemctl restart sugar-orbits
```

Use your own Dexcom publisher account. Region is `ous` for Germany. Never upload this file, print it into shared logs, or send screenshots of it.

## Optional: open the Pi app in your PC browser securely

The app normally listens only on the Pi. From a **new Windows PowerShell tab**, create an SSH tunnel:

```powershell
ssh -N -L 8788:127.0.0.1:8787 rob@sugarorbits.local
```

After entering your Pi password, the window appears to do nothing—that is normal for a tunnel. Leave it open, then visit [http://127.0.0.1:8788](http://127.0.0.1:8788) in your PC browser. If that local port is already in use, choose another free local port.

Press **Ctrl+C** to close the tunnel. This does not stop the Pi app. No firewall changes or public app access are needed.

## Optional: copy a file from the PC to the Pi

Run in **Windows PowerShell**, not inside the Pi SSH session:

```powershell
scp "$HOME\Downloads\sugar-orbits-pi-round-week-history-2026-09-14.zip" rob@sugarorbits.local:~/
```

This example requires that exact ZIP in Downloads and copies it to the Pi home folder. It does not install or start it. Normal updates now use GitHub, so you do not need this ZIP.

If a stray quote leaves PowerShell waiting at `>>`, press **Ctrl+C** and paste the command again without extra quotation marks.

## Useful terminal controls

| Action | Keys / command |
| --- | --- |
| Stop a foreground command or cancel unfinished input | Ctrl+C |
| Disconnect from SSH | `exit` |
| Exit `top` or a paged log view | q |
| Save in nano | Ctrl+O, then Enter |
| Exit nano | Ctrl+X |
| Restore tiny text in Windows Terminal | Ctrl+Shift+P → search “Reset font size” |

App code is versioned on GitHub. Pi credentials, glucose history, and live system configuration are not automatically uploaded. See [Pi setup](docs/PI_SETUP.md) for the recorded service and desktop configuration.
