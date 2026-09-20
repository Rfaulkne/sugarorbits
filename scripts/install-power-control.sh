#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo: sudo bash scripts/install-power-control.sh" >&2
  exit 1
fi

APP_USER="${SUDO_USER:-rob}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
SUDOERS_FILE="/etc/sudoers.d/sugar-orbits-poweroff"
TEMP_FILE="$(mktemp)"
trap 'rm -f "${TEMP_FILE}"' EXIT

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "User ${APP_USER} does not exist." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "${ENV_FILE} is missing. Configure Sugar Orbits before installing power control." >&2
  exit 1
fi

printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl poweroff\n' "${APP_USER}" > "${TEMP_FILE}"
chmod 0440 "${TEMP_FILE}"
/usr/sbin/visudo -cf "${TEMP_FILE}" >/dev/null
install -o root -g root -m 0440 "${TEMP_FILE}" "${SUDOERS_FILE}"

if grep -q '^ALLOW_SYSTEM_SHUTDOWN=' "${ENV_FILE}"; then
  sed -i 's/^ALLOW_SYSTEM_SHUTDOWN=.*/ALLOW_SYSTEM_SHUTDOWN=true/' "${ENV_FILE}"
else
  printf '\n# Local Pi touchscreen shutdown control.\nALLOW_SYSTEM_SHUTDOWN=true\n' >> "${ENV_FILE}"
fi
chown "${APP_USER}:$(id -gn "${APP_USER}")" "${ENV_FILE}"
chmod 0600 "${ENV_FILE}"

systemctl restart sugar-orbits
echo "Screen shutdown is installed. Reboot once to refresh the kiosk interface."
