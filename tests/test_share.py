from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_DIR))

from app_auth import access_code_matches, create_session_value, verify_session_value  # noqa: E402
from dexcom_share import DexcomShareCollector, DexcomShareConfig  # noqa: E402
from glucose_store import GlucoseStore  # noqa: E402


class FakeReading:
    def __init__(self, recorded: datetime, value: int, trend: str = "Flat"):
        self.datetime = recorded
        self.mg_dl = value
        self.trend_direction = trend
        self.trend_arrow = "→"


class FakeDexcom:
    readings: list[FakeReading] = []
    arguments: dict[str, object] = {}

    def __init__(self, **arguments: object):
        type(self).arguments = arguments

    def get_glucose_readings(self, minutes: int, max_count: int) -> list[FakeReading]:
        self.request = (minutes, max_count)
        return type(self).readings


class DexcomShareTests(unittest.TestCase):
    def test_germany_uses_outside_us_region(self) -> None:
        config = DexcomShareConfig(username="rob", password="private", region="ous")
        self.assertTrue(config.configured)
        self.assertEqual(config.normalized_region.value, "ous")

    def test_exactly_one_account_identifier_is_required(self) -> None:
        self.assertFalse(DexcomShareConfig(password="private").configured)
        self.assertFalse(
            DexcomShareConfig(
                username="rob", account_id="uuid", password="private"
            ).configured
        )

    def test_sync_normalizes_and_deduplicates_readings(self) -> None:
        local_zone = timezone(timedelta(hours=2))
        recorded = datetime.now(local_zone).replace(microsecond=0)
        FakeDexcom.readings = [FakeReading(recorded, 126)]
        with tempfile.TemporaryDirectory() as directory:
            store = GlucoseStore(Path(directory))
            collector = DexcomShareCollector(
                DexcomShareConfig(username="rob", password="private", region="ous"),
                store,
                client_factory=FakeDexcom,
            )
            collector.sync()
            collector.sync()
            records = store.records(1)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["valueMgDl"], 126)
        self.assertEqual(records[0]["valueMmol"], 7.0)
        self.assertTrue(records[0]["displayTime"].endswith("+02:00"))
        self.assertEqual(FakeDexcom.arguments["username"], "rob")

    def test_start_runs_initial_sync_automatically(self) -> None:
        recorded = datetime.now(timezone.utc).replace(microsecond=0)
        FakeDexcom.readings = [FakeReading(recorded, 117)]
        with tempfile.TemporaryDirectory() as directory:
            store = GlucoseStore(Path(directory))
            collector = DexcomShareCollector(
                DexcomShareConfig(
                    username="rob",
                    password="private",
                    region="ous",
                    poll_seconds=300,
                ),
                store,
                client_factory=FakeDexcom,
            )
            collector.start()
            try:
                self.assertTrue(collector.wait_for_initial_attempt(timeout=1.0))
                records = store.records(1)
                status = collector.status()
            finally:
                collector.stop()

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["valueMgDl"], 117)
        self.assertIsNotNone(status["lastSyncAt"])

    def test_restart_backfills_holes_before_recent_cached_reading(self) -> None:
        now = datetime.now(timezone.utc).replace(microsecond=0)

        class WindowedDexcom(FakeDexcom):
            def get_glucose_readings(self, minutes, max_count):
                self.request = (minutes, max_count)
                cutoff = now - timedelta(minutes=minutes)
                return sorted(
                    [r for r in self.readings if r.datetime >= cutoff],
                    key=lambda r: r.datetime, reverse=True,
                )[:max_count]

        with tempfile.TemporaryDirectory() as directory:
            store = GlucoseStore(Path(directory))
            recent = now - timedelta(minutes=5)
            store.upsert([{
                "systemTime": recent.isoformat(), "displayTime": recent.isoformat(),
                "valueMgDl": 108, "valueMmol": 6.0,
            }])
            # Simulate a restarted collector with a recent point but a large hole.
            WindowedDexcom.readings = [
                FakeReading(now - timedelta(minutes=5 * i), 108)
                for i in range(288)
            ]
            collector = DexcomShareCollector(
                DexcomShareConfig(username="test", password="test"),
                GlucoseStore(Path(directory)), client_factory=WindowedDexcom,
            )
            collector.start()
            try:
                self.assertTrue(collector.wait_for_initial_attempt(2))
            finally:
                collector.stop()
            self.assertEqual(store.stats()["count"], 288)
            self.assertEqual(collector._client.request, (1440, 288))
            # A later response can fill an older hole even with fresh data cached.
            extra = FakeReading(now - timedelta(hours=12, minutes=2), 126)
            WindowedDexcom.readings = [extra, FakeReading(now, 108)]
            collector.sync()
            self.assertEqual(store.stats()["count"], 289)
            self.assertEqual(len(store.records(1)), 289)

    def test_boot_network_failure_retries_after_one_minute(self) -> None:
        class UnavailableDexcom(FakeDexcom):
            def get_glucose_readings(self, minutes, max_count):
                raise ConnectionError("offline")

        class StopAfterWait:
            delay = None
            def wait(self, delay):
                self.delay = delay
                return True

        with tempfile.TemporaryDirectory() as directory:
            collector = DexcomShareCollector(
                DexcomShareConfig(username="test", password="test"),
                GlucoseStore(Path(directory)), client_factory=UnavailableDexcom,
            )
            stop = StopAfterWait()
            collector._stop_event = stop
            collector._run()
            self.assertEqual(stop.delay, 60)
            self.assertTrue(collector.wait_for_initial_attempt(0))
            self.assertIn("offline", collector.status()["lastError"])


class GlucoseStoreTests(unittest.TestCase):
    def test_archive_orders_records_and_reports_stats(self) -> None:
        now = datetime.now(timezone.utc).replace(microsecond=0)
        with tempfile.TemporaryDirectory() as directory:
            store = GlucoseStore(Path(directory))
            store.upsert(
                [
                    {
                        "systemTime": (now - timedelta(minutes=5)).isoformat(),
                        "displayTime": (now - timedelta(minutes=5)).isoformat(),
                        "valueMgDl": 90,
                        "valueMmol": 5.0,
                        "trend": "Flat",
                        "trendArrow": "→",
                    },
                    {
                        "systemTime": now.isoformat(),
                        "displayTime": now.isoformat(),
                        "valueMgDl": 108,
                        "valueMmol": 6.0,
                        "trend": "FortyFiveUp",
                        "trendArrow": "↗",
                    },
                ]
            )
            records = store.records(1)
            stats = store.stats()

        self.assertEqual([item["valueMgDl"] for item in records], [90, 108])
        self.assertEqual(stats["count"], 2)
        self.assertEqual(stats["newestSystemTime"], now.isoformat())

    def test_archive_keeps_four_weeks_plus_comparison_week(self) -> None:
        now = datetime.now(timezone.utc).replace(microsecond=0)
        with tempfile.TemporaryDirectory() as directory:
            store = GlucoseStore(Path(directory), retention_days=35)
            readings = []
            for age_days in (34, 36):
                recorded = now - timedelta(days=age_days)
                readings.append(
                    {
                        "systemTime": recorded.isoformat(),
                        "displayTime": recorded.isoformat(),
                        "valueMgDl": 108,
                        "valueMmol": 6.0,
                        "trend": "Flat",
                        "trendArrow": "→",
                    }
                )
            store.upsert(readings)
            records = store.records(40)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["systemTime"], (now - timedelta(days=34)).isoformat())


class AppAuthTests(unittest.TestCase):
    def test_signed_session_round_trip_and_expiry(self) -> None:
        session = create_session_value("session-secret", now=1_000)
        self.assertTrue(verify_session_value(session, "session-secret", now=1_001))
        self.assertFalse(verify_session_value(session, "wrong-secret", now=1_001))
        self.assertFalse(verify_session_value(session, "session-secret", now=3_000_000))

    def test_access_code_match(self) -> None:
        self.assertTrue(access_code_matches("orbit-code", "orbit-code"))
        self.assertFalse(access_code_matches("wrong", "orbit-code"))
        self.assertFalse(access_code_matches("", "orbit-code"))


if __name__ == "__main__":
    unittest.main()
