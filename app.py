from __future__ import annotations

import json
import os
import socket
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from app_auth import access_code_matches, create_session_value, verify_session_value
from dexcom_share import DexcomShareCollector, DexcomShareConfig, DexcomShareError
from glucose_store import GlucoseStore


PROJECT_DIR = Path(__file__).resolve().parent
STATIC_DIR = PROJECT_DIR / "static"


def load_local_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env(PROJECT_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    app_base_url: str
    data_dir: Path
    dexcom_share_username: str
    dexcom_share_account_id: str
    dexcom_share_password: str
    dexcom_share_region: str
    dexcom_poll_seconds: int
    app_access_code: str
    app_session_secret: str

    @property
    def configured(self) -> bool:
        identifiers = int(bool(self.dexcom_share_username)) + int(
            bool(self.dexcom_share_account_id)
        )
        return bool(self.dexcom_share_password) and identifiers == 1


def read_settings() -> Settings:
    app_base_url = (
        os.getenv("APP_BASE_URL")
        or os.getenv("RENDER_EXTERNAL_URL")
        or "http://127.0.0.1:8787"
    )
    return Settings(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8787")),
        app_base_url=app_base_url,
        data_dir=Path(os.getenv("DATA_DIR", str(PROJECT_DIR / ".data"))),
        dexcom_share_username=os.getenv("DEXCOM_SHARE_USERNAME", ""),
        dexcom_share_account_id=os.getenv("DEXCOM_SHARE_ACCOUNT_ID", ""),
        dexcom_share_password=os.getenv("DEXCOM_SHARE_PASSWORD", ""),
        dexcom_share_region=os.getenv("DEXCOM_SHARE_REGION", "ous"),
        dexcom_poll_seconds=max(60, int(os.getenv("DEXCOM_POLL_SECONDS", "300"))),
        app_access_code=os.getenv("APP_ACCESS_CODE", ""),
        app_session_secret=os.getenv("APP_SESSION_SECRET", ""),
    )


SETTINGS = read_settings()
GLUCOSE_STORE = GlucoseStore(SETTINGS.data_dir)
COLLECTOR = DexcomShareCollector(
    DexcomShareConfig(
        username=SETTINGS.dexcom_share_username,
        account_id=SETTINGS.dexcom_share_account_id,
        password=SETTINGS.dexcom_share_password,
        region=SETTINGS.dexcom_share_region,
        poll_seconds=SETTINGS.dexcom_poll_seconds,
    ),
    GLUCOSE_STORE,
)


def fetch_cached_glucose(days: int) -> dict[str, Any]:
    if SETTINGS.configured and not COLLECTOR.status()["lastSyncAt"]:
        # Usually this lets the first page show the freshly collected reading.
        # The timeout preserves an immediate cached/offline experience if the
        # network request is slow or unavailable.
        COLLECTOR.wait_for_initial_attempt(timeout=4.0)
    records = GLUCOSE_STORE.records(days)
    if not records:
        status = COLLECTOR.status()
        raise DexcomShareError(
            status.get("lastError")
            or "No Dexcom readings are stored yet. Confirm Share is enabled in the G7 app."
        )

    values = [float(record["valueMmol"]) for record in records]
    available_dates = {
        str(record.get("displayTime") or "")[:10]
        for record in records
        if str(record.get("displayTime") or "")[:10]
    }
    collector_status = COLLECTOR.status()
    return {
        "days": days,
        "source": "dexcom-share",
        "region": SETTINGS.dexcom_share_region,
        "averageMmol": round(sum(values) / len(values), 2),
        "availableDays": len(available_dates),
        "storedReadings": collector_status["storedReadings"],
        "lastSyncAt": collector_status["lastSyncAt"],
        "syncError": collector_status["lastError"],
        "lastAvailableSystemTime": records[-1]["systemTime"],
        "lastAvailableDisplayTime": records[-1]["displayTime"],
        "records": records,
    }


class AppHandler(BaseHTTPRequestHandler):
    server_version = "SugarOrbits/0.3"

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {self.command} {urlsplit(self.path).path}")

    def _security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if SETTINGS.app_base_url.startswith("https://"):
            self.send_header("Strict-Transport-Security", "max-age=31536000")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; "
            "base-uri 'none'; form-action 'self'",
        )

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location: str, cookie: str | None = None) -> None:
        self.send_response(HTTPStatus.FOUND)
        self._security_headers()
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def _serve_static(self, filename: str, content_type: str) -> None:
        path = STATIC_DIR / filename
        try:
            body = path.read_bytes()
        except FileNotFoundError:
            self._json(404, {"error": "not_found"})
            return
        self.send_response(HTTPStatus.OK)
        self._security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cookies(self) -> SimpleCookie[str]:
        cookies: SimpleCookie[str] = SimpleCookie()
        cookies.load(self.headers.get("Cookie", ""))
        return cookies

    def _app_cookie(self, value: str, max_age: int) -> str:
        secure = "; Secure" if SETTINGS.app_base_url.startswith("https://") else ""
        return (
            f"sugar_orbits_session={value}; Path=/; Max-Age={max_age}; "
            f"HttpOnly; SameSite=Lax{secure}"
        )

    def _app_authorized(self) -> bool:
        if not SETTINGS.app_access_code:
            return True
        cookie = self._cookies().get("sugar_orbits_session")
        return bool(cookie) and verify_session_value(
            cookie.value, SETTINGS.app_session_secret
        )

    def _read_form(self) -> dict[str, list[str]]:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length < 1 or content_length > 4096:
            return {}
        body = self.rfile.read(content_length).decode("utf-8", errors="replace")
        return parse_qs(body)

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/healthz":
            self._json(200, {"status": "ok", "source": "dexcom-share"})
            return
        if parsed.path == "/unlock":
            if self._app_authorized():
                self._redirect("/")
            else:
                self._serve_static("unlock.html", "text/html; charset=utf-8")
            return
        public_static = {
            "/styles.css",
            "/manifest.webmanifest",
            "/app-icon-180.png",
            "/app-icon-512.png",
            "/sw.js",
        }
        if not self._app_authorized() and parsed.path not in public_static:
            if parsed.path.startswith("/api/"):
                self._json(401, {"error": "app_locked", "message": "Unlock Sugar Orbits first"})
            else:
                self._redirect("/unlock")
            return
        static_routes = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/orbit-palette.js": ("orbit-palette.js", "text/javascript; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
            "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json; charset=utf-8"),
            "/sw.js": ("sw.js", "text/javascript; charset=utf-8"),
            "/app-icon-180.png": ("app-icon-180.png", "image/png"),
            "/app-icon-512.png": ("app-icon-512.png", "image/png"),
        }
        if parsed.path in static_routes:
            self._serve_static(*static_routes[parsed.path])
            return
        if parsed.path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        if parsed.path == "/api/status":
            status = COLLECTOR.status()
            status.update(
                {
                    "source": "dexcom-share",
                    "region": SETTINGS.dexcom_share_region,
                    "pollSeconds": SETTINGS.dexcom_poll_seconds,
                }
            )
            self._json(200, status)
            return
        if parsed.path == "/api/glucose":
            query = parse_qs(parsed.query)
            try:
                days = max(1, min(35, int(query.get("days", ["35"])[0])))
                if not SETTINGS.configured:
                    self._json(
                        503,
                        {
                            "error": "not_configured",
                            "message": "Add your private Dexcom Share credentials to .env",
                        },
                    )
                    return
                self._json(200, fetch_cached_glucose(days))
            except DexcomShareError as exc:
                self._json(502, {"error": "dexcom_share_error", "message": str(exc)})
            except (RuntimeError, ValueError) as exc:
                self._json(500, {"error": "data_error", "message": str(exc)})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path == "/auth/app":
            submitted = self._read_form().get("access_code", [""])[0]
            if access_code_matches(submitted, SETTINGS.app_access_code):
                session_value = create_session_value(SETTINGS.app_session_secret)
                self._redirect("/", self._app_cookie(session_value, 60 * 60 * 24 * 30))
            else:
                time.sleep(0.35)
                self._redirect("/unlock#error")
            return
        if not self._app_authorized():
            self._json(401, {"error": "app_locked", "message": "Unlock Sugar Orbits first"})
            return
        if parsed.path == "/api/sync":
            try:
                changed = COLLECTOR.sync()
                self._json(200, {"synced": True, "updatedReadings": changed})
            except DexcomShareError as exc:
                self._json(502, {"error": "dexcom_share_error", "message": str(exc)})
            return
        self._json(404, {"error": "not_found"})


def main() -> None:
    lan_preview = os.getenv("ALLOW_LAN_PREVIEW", "").lower() in {"1", "true", "yes"}
    public_bind = SETTINGS.host not in {"127.0.0.1", "localhost", "::1"}
    if public_bind and not lan_preview:
        missing = []
        if not SETTINGS.app_base_url.startswith("https://"):
            missing.append("an HTTPS APP_BASE_URL")
        if not SETTINGS.app_access_code:
            missing.append("APP_ACCESS_CODE")
        if not SETTINGS.app_session_secret:
            missing.append("APP_SESSION_SECRET")
        if missing:
            raise SystemExit(
                "Refusing to expose private glucose data. Public hosting requires "
                + ", ".join(missing)
                + "."
            )

    COLLECTOR.start()
    server = ThreadingHTTPServer((SETTINGS.host, SETTINGS.port), AppHandler)
    print(f"Sugar Orbits is running at {SETTINGS.app_base_url}")
    print(f"Dexcom source: Share ({SETTINGS.dexcom_share_region})")
    if not SETTINGS.configured:
        print("Dexcom Share setup is incomplete. Open .env and add your private credentials.")
    if SETTINGS.host == "0.0.0.0" and lan_preview:
        try:
            addresses = {
                item[4][0]
                for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
                if not item[4][0].startswith("127.")
            }
        except socket.gaierror:
            addresses = set()
        if addresses:
            print(f"iPhone preview: http://{sorted(addresses)[0]}:{SETTINGS.port}")
        else:
            print(f"iPhone preview: use this PC's Wi-Fi IPv4 address with port {SETTINGS.port}")
        print("LAN preview exposes glucose data to devices on this network; use trusted Wi-Fi only.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        COLLECTOR.stop()
        server.server_close()


if __name__ == "__main__":
    main()
