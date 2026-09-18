from __future__ import annotations

import math
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from pydexcom import Dexcom, Region

from glucose_store import GlucoseStore


class DexcomShareError(RuntimeError):
    pass


@dataclass(frozen=True)
class DexcomShareConfig:
    password: str
    username: str = ""
    account_id: str = ""
    region: str = "ous"
    poll_seconds: int = 300

    @property
    def configured(self) -> bool:
        identifiers = int(bool(self.username)) + int(bool(self.account_id))
        return bool(self.password) and identifiers == 1

    @property
    def normalized_region(self) -> Region:
        try:
            return Region(self.region.lower())
        except ValueError as exc:
            raise ValueError("DEXCOM_SHARE_REGION must be us, ous, or jp") from exc


class DexcomShareCollector:
    """Fetch Dexcom Share readings and retain them in a local rolling archive."""

    def __init__(
        self,
        config: DexcomShareConfig,
        store: GlucoseStore,
        client_factory: Callable[..., Any] = Dexcom,
    ):
        self.config = config
        self.store = store
        self.client_factory = client_factory
        self._client: Any | None = None
        self._sync_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._initial_attempt_complete = threading.Event()
        self._last_success: str | None = None
        self._last_error: str | None = None
        self._syncing = False

    def _client_instance(self) -> Any:
        if self._client is None:
            arguments: dict[str, Any] = {
                "password": self.config.password,
                "region": self.config.normalized_region,
            }
            if self.config.account_id:
                arguments["account_id"] = self.config.account_id
            else:
                arguments["username"] = self.config.username
            self._client = self.client_factory(**arguments)
        return self._client

    def _minutes_to_fetch(self) -> int:
        newest = self.store.stats().get("newestSystemTime")
        if not newest:
            return 1440
        try:
            latest = datetime.fromisoformat(str(newest).replace("Z", "+00:00"))
            if latest.tzinfo is None:
                latest = latest.replace(tzinfo=timezone.utc)
            age_minutes = (datetime.now(timezone.utc) - latest.astimezone(timezone.utc)).total_seconds() / 60
        except (TypeError, ValueError):
            return 1440
        return max(60, min(1440, math.ceil(age_minutes) + 20))

    def sync(self) -> int:
        if not self.config.configured:
            raise DexcomShareError(
                "Add your Dexcom Share username (or account ID) and password to .env"
            )
        if not self._sync_lock.acquire(blocking=False):
            return 0
        self._syncing = True
        try:
            minutes = self._minutes_to_fetch()
            max_count = min(288, max(12, math.ceil(minutes / 5) + 4))
            readings = self._client_instance().get_glucose_readings(
                minutes=minutes, max_count=max_count
            )
            normalized = []
            for reading in readings:
                recorded = reading.datetime
                if recorded.tzinfo is None:
                    recorded = recorded.replace(tzinfo=timezone.utc)
                normalized.append(
                    {
                        "systemTime": recorded.astimezone(timezone.utc).isoformat(timespec="seconds"),
                        "displayTime": recorded.isoformat(timespec="seconds"),
                        "valueMgDl": int(reading.mg_dl),
                        "valueMmol": round(float(reading.mg_dl) / 18.0, 2),
                        "trend": reading.trend_direction,
                        "trendArrow": reading.trend_arrow,
                    }
                )
            if not normalized:
                raise DexcomShareError(
                    "Dexcom Share returned no readings. Confirm Share is enabled "
                    "in the G7 app and at least one follower is active."
                )
            changed = self.store.upsert(normalized)
            self._last_success = datetime.now(timezone.utc).isoformat(timespec="seconds")
            self._last_error = None
            return changed
        except DexcomShareError as exc:
            self._last_error = str(exc)
            raise
        except Exception as exc:
            self._client = None
            message = str(exc).strip() or exc.__class__.__name__
            wrapped = DexcomShareError(f"Dexcom Share sync failed: {message}")
            self._last_error = str(wrapped)
            raise wrapped from exc
        finally:
            self._syncing = False
            self._sync_lock.release()

    def sync_safely(self) -> None:
        try:
            self.sync()
        except DexcomShareError as exc:
            self._last_error = str(exc)

    def start(self) -> None:
        if not self.config.configured or (self._thread and self._thread.is_alive()):
            return
        self._thread = threading.Thread(
            target=self._run, name="dexcom-share-sync", daemon=True
        )
        self._thread.start()

    def _run(self) -> None:
        # Keep startup non-blocking so cached data remains available even when
        # Wi-Fi or Dexcom Share is temporarily unreachable.
        self.sync_safely()
        self._initial_attempt_complete.set()
        while not self._stop_event.wait(max(60, self.config.poll_seconds)):
            self.sync_safely()

    def wait_for_initial_attempt(self, timeout: float = 4.0) -> bool:
        """Wait briefly for startup data without making the UI depend on Wi-Fi."""
        return self._initial_attempt_complete.wait(max(0.0, timeout))

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def status(self) -> dict[str, Any]:
        stats = self.store.stats()
        return {
            "configured": self.config.configured,
            "connected": bool(self._last_success or stats["count"]),
            "syncing": self._syncing,
            "region": self.config.region,
            "lastSyncAt": self._last_success,
            "lastError": self._last_error,
            "storedReadings": stats["count"],
            "oldestSystemTime": stats["oldestSystemTime"],
            "newestSystemTime": stats["newestSystemTime"],
        }
