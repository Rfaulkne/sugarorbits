from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable


class GlucoseStore:
    """Rolling archive for four visible weeks plus week-over-week context."""

    def __init__(self, data_dir: Path, retention_days: int = 35):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "glucose.sqlite3"
        self.retention_days = max(29, retention_days)
        self._lock = threading.RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS glucose_readings (
                    system_time TEXT PRIMARY KEY,
                    display_time TEXT NOT NULL,
                    value_mg_dl INTEGER NOT NULL,
                    value_mmol REAL NOT NULL,
                    trend TEXT,
                    trend_arrow TEXT,
                    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_glucose_display_time "
                "ON glucose_readings(display_time)"
            )

    def upsert(self, readings: Iterable[dict[str, Any]]) -> int:
        rows = [
            (
                str(item["systemTime"]),
                str(item["displayTime"]),
                int(item["valueMgDl"]),
                float(item["valueMmol"]),
                item.get("trend"),
                item.get("trendArrow"),
            )
            for item in readings
        ]
        if not rows:
            return 0
        with self._lock, self._connect() as connection:
            before = connection.total_changes
            connection.executemany(
                """
                INSERT INTO glucose_readings(
                    system_time, display_time, value_mg_dl, value_mmol,
                    trend, trend_arrow
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(system_time) DO UPDATE SET
                    display_time = excluded.display_time,
                    value_mg_dl = excluded.value_mg_dl,
                    value_mmol = excluded.value_mmol,
                    trend = excluded.trend,
                    trend_arrow = excluded.trend_arrow
                """,
                rows,
            )
            changed = connection.total_changes - before
        self.prune()
        return changed

    def prune(self, now: datetime | None = None) -> None:
        current = now or datetime.now(timezone.utc)
        cutoff = (current - timedelta(days=self.retention_days)).isoformat()
        with self._lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM glucose_readings WHERE system_time < ?", (cutoff,)
            )

    def records(self, days: int, now: datetime | None = None) -> list[dict[str, Any]]:
        current = now or datetime.now(timezone.utc)
        cutoff = (current - timedelta(days=days)).isoformat()
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT system_time, display_time, value_mg_dl, value_mmol,
                       trend, trend_arrow
                FROM glucose_readings
                WHERE system_time >= ?
                ORDER BY system_time
                """,
                (cutoff,),
            ).fetchall()
        return [
            {
                "id": row["system_time"],
                "systemTime": row["system_time"],
                "displayTime": row["display_time"],
                "valueMgDl": row["value_mg_dl"],
                "valueMmol": row["value_mmol"],
                "trend": row["trend"],
                "trendArrow": row["trend_arrow"],
            }
            for row in rows
        ]

    def stats(self) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*) AS count,
                       MIN(system_time) AS oldest_system_time,
                       MAX(system_time) AS newest_system_time,
                       MIN(display_time) AS oldest_display_time,
                       MAX(display_time) AS newest_display_time
                FROM glucose_readings
                """
            ).fetchone()
        return {
            "count": int(row["count"]),
            "oldestSystemTime": row["oldest_system_time"],
            "newestSystemTime": row["newest_system_time"],
            "oldestDisplayTime": row["oldest_display_time"],
            "newestDisplayTime": row["newest_display_time"],
        }

    def clear(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM glucose_readings")
