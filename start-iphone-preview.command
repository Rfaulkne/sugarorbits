#!/bin/bash

set -u

cd "$(dirname "$0")" || exit 1

pause_before_exit() {
    printf '\nPress Return to close this window.'
    read -r _
}

if ! command -v python3 >/dev/null 2>&1; then
    printf '\nPython 3 is not installed on this Mac.\n'
    printf 'Download it from python.org, install it, then open this file again.\n'
    open "https://www.python.org/downloads/macos/"
    pause_before_exit
    exit 1
fi

VENV_PYTHON="./.venv/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
    printf '\nPreparing Sugar Orbits for this Mac...\n'
    if ! python3 -m venv .venv; then
        printf '\nI could not create the Python environment.\n'
        pause_before_exit
        exit 1
    fi
fi

if ! "$VENV_PYTHON" -m pip install --disable-pip-version-check -r requirements.txt; then
    printf '\nI could not install the app requirements.\n'
    pause_before_exit
    exit 1
fi

if [ ! -f .env ]; then
    cp .env.example .env
    printf '\nYour private .env file has been created and opened in TextEdit.\n'
    printf 'Add your Dexcom Share username and password, save it, then open\n'
    printf 'start-iphone-preview.command again.\n'
    open -e .env
    pause_before_exit
    exit 0
fi

if ! grep -Eq '^DEXCOM_SHARE_USERNAME=.+$' .env || ! grep -Eq '^DEXCOM_SHARE_PASSWORD=.+$' .env; then
    printf '\nYour Dexcom Share username or password is still blank.\n'
    printf 'Add both values, keep region set to ous for Germany, save, then open this starter again.\n'
    open -e .env
    pause_before_exit
    exit 1
fi

WIFI_INTERFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
LAN_ADDRESS=""

if [ -n "$WIFI_INTERFACE" ]; then
    LAN_ADDRESS="$(ipconfig getifaddr "$WIFI_INTERFACE" 2>/dev/null || true)"
fi
if [ -z "$LAN_ADDRESS" ]; then
    LAN_ADDRESS="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [ -z "$LAN_ADDRESS" ]; then
    LAN_ADDRESS="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi

if [ -z "$LAN_ADDRESS" ]; then
    printf '\nI could not find this Mac\x27s Wi-Fi address.\n'
    printf 'Connect the Mac to Wi-Fi, then open this file again.\n'
    pause_before_exit
    exit 1
fi

printf '\nSugar Orbits is ready.\n\n'
printf 'On your iPhone, open this address in Safari:\n\n'
printf '   http://%s:8787\n\n' "$LAN_ADDRESS"
printf 'Keep this window open. Press Control-C to stop Sugar Orbits.\n'
printf 'Both devices must remain on the same trusted Wi-Fi.\n\n'

(
    attempt=0
    while [ "$attempt" -lt 50 ]; do
        if curl -fsS "http://127.0.0.1:8787/healthz" >/dev/null 2>&1; then
            open "http://127.0.0.1:8787"
            exit 0
        fi
        attempt=$((attempt + 1))
        sleep 0.2
    done
) &

HOST=0.0.0.0 ALLOW_LAN_PREVIEW=true exec "$VENV_PYTHON" app.py
