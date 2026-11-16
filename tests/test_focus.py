from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from orbit_focus import FocusStore, Rhythm, instant, guide
from orbit_ai import OrbitAI, AIUnavailable
from orbit_demo import demo_records

UTC = timezone.utc
NOW = datetime(2026, 11, 16, 18, tzinfo=UTC)
TZ = ZoneInfo("Europe/Berlin")


def readings(day, value=7, missing=()):
    begin = datetime.combine(day, datetime.min.time(), TZ).astimezone(UTC)
    finish = (datetime.combine(day, datetime.min.time(), TZ) + timedelta(days=1)).astimezone(UTC)
    result = []
    at = begin
    while at < finish:
        local = at.astimezone(TZ)
        minute = local.hour * 60 + local.minute
        if minute not in missing:
            result.append({"systemTime": at.isoformat(), "valueMmol": value(minute) if callable(value) else value})
        at += timedelta(minutes=5)
    return result


class RhythmTests(unittest.TestCase):
    def week(self, value=7):
        return [r for i in range(1, 8) for r in readings(NOW.astimezone(TZ).date() - timedelta(days=i), value)]

    def test_actual_mean_and_outside_frequency_are_independent(self):
        data = []
        for i in range(1, 8):
            data += readings(NOW.date() - timedelta(days=i), 12 if i <= 3 else 3)
        state = Rhythm(data, now=NOW).state()
        b = state["profile"][24]
        self.assertAlmostEqual(b["mean"], (12 * 3 + 3 * 4) / 7, places=2)
        self.assertGreater(b["highFraction"], .4)
        self.assertGreater(b["lowFraction"], .5)
        self.assertTrue(3.9 < b["mean"] < 10)
        self.assertEqual(state["candidates"][0]["kind"], "low")

    def test_missing_days_are_not_zero_or_fabricated(self):
        state = Rhythm(readings(NOW.date() - timedelta(days=1)), now=NOW).state()
        self.assertIsNone(state["profile"][0]["mean"])
        self.assertEqual(state["profile"][0]["validDays"], 1)
        self.assertEqual(state["days"][0]["points"], [])
        self.assertEqual(state["days"][0]["mean"], None)

    def test_midnight_uses_system_time_and_app_timezone(self):
        r = Rhythm([{"systemTime": "2026-11-15T23:05:00Z", "displayTime": "1990-01-01", "valueMmol": 7}], now=NOW)
        self.assertEqual(r.days[NOW.date()][0][2], 5)

    def test_seven_complete_days_excludes_today_and_older_week(self):
        data = self.week(6) + readings(NOW.date(), 15) + readings(NOW.date() - timedelta(days=8), 20)
        s = Rhythm(data, now=NOW).state()
        self.assertEqual(s["profile"][0]["mean"], 6)
        self.assertEqual(s["weekStats"]["mean"], 6)
        self.assertIsNone(s["previousProfile"][0]["mean"])

    def test_no_duplicate_sample_weight(self):
        data = self.week(7)
        s = Rhythm(data + data * 5, now=NOW).state()
        self.assertEqual(s["profile"][0]["mean"], 7)
        self.assertEqual(s["profile"][0]["validDays"], 7)

    def test_partial_window_cannot_be_mistaken_for_full_coverage(self):
        data = readings(NOW.date() - timedelta(days=1), 12, missing=range(12 * 60, 14 * 60))
        r = Rhythm(data, now=NOW)
        stats = r.window([NOW.date() - timedelta(days=1)], 720, 900)
        self.assertEqual(stats["validDays"], 0)
        self.assertIsNone(stats["mean"])

    def test_average_equally_weights_days_not_number_of_samples(self):
        days = [NOW.date() - timedelta(days=i) for i in range(1, 4)]
        data = readings(days[0], 12, missing=[0]) + readings(days[1], 6) + readings(days[2], 6)
        self.assertEqual(Rhythm(data, now=NOW).profile(days)[0]["mean"], 8)

    def test_isolated_highs_not_a_sustained_pattern(self):
        data = self.week(lambda m: 11 if m % 60 == 0 else 7)
        self.assertEqual(Rhythm(data, now=NOW).candidates(), [])

    def test_spring_and_autumn_dst_coverage(self):
        for day, count in [(datetime(2026, 3, 29).date(), 276), (datetime(2026, 10, 25).date(), 300)]:
            data = readings(day)
            self.assertEqual(len(data), count)
            rhythm = Rhythm(data, now=NOW)
            s = rhythm.window([day], 0, 1440)
            self.assertEqual(s["meanCoverage"], 1)
            self.assertEqual(rhythm.expected_slots(day, 150, 180), 0 if count == 276 else 12)

    def test_future_nan_or_invalid_readings_do_not_enter_patterns(self):
        data = self.week() + [{"systemTime": (NOW + timedelta(hours=1)).isoformat(), "valueMmol": 12},
                              {"systemTime": NOW.isoformat(), "valueMmol": float('nan')}]
        self.assertEqual(Rhythm(data, now=NOW).state()["weekStats"]["mean"], 7)


class FocusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = FocusStore(Path(self.temp.name))
        self.rhythm = Rhythm(demo_records(now=NOW), now=NOW)

    def event(self, **kw):
        return {"id": str(uuid.uuid4()), "at": NOW.isoformat(), "kind": "activity", **kw}

    def focus(self):
        return self.store.start_focus({"start": 720, "end": 900, "habit": "Notice lunch", "kind": "high"}, self.rhythm)

    def test_event_idempotency_retention_and_cap(self):
        event = self.event()
        self.store.add_event(event, NOW)
        self.store.add_event(event, NOW)
        self.assertEqual(len(self.store.events(NOW)), 1)
        for i in range(25):
            self.store.add_event(self.event(at=(NOW-timedelta(minutes=i)).isoformat()), NOW)
        self.assertEqual(len(self.store.events(NOW)), 20)
        self.assertEqual(self.store.events(NOW+timedelta(days=29)), [])

    def test_validates_kind_future_and_nonfinite_carbs(self):
        for kw in [{"kind":"wrong"}, {"at":(NOW+timedelta(hours=1)).isoformat()}, {"kind":"food","carbs":float('nan')}, {"carbs":15}]:
            with self.assertRaises(ValueError):
                self.store.add_event(self.event(**kw), NOW)

    def test_baseline_frozen_and_only_one_focus(self):
        f = self.focus()
        with self.assertRaises(ValueError):
            self.focus()
        later = Rhythm([], now=NOW+timedelta(days=7))
        stored = self.store.focus_state(later)
        self.assertEqual(stored["baseline"], f["baseline"])
        self.assertTrue(stored["reviewDue"])
        self.assertFalse(stored["enoughToCompare"])
        self.assertEqual(stored["followup"]["validDays"], 0)

    def test_checkin_is_upsert_not_an_event_and_missing_is_unknown(self):
        f = self.focus()
        payload={"focusId":f["id"],"day":NOW.date().isoformat(),"status":"done"}
        self.store.checkin(payload,self.rhythm)
        self.store.checkin({**payload,"status":"partly"},self.rhythm)
        s=self.store.focus_state(self.rhythm)
        self.assertEqual(len(s["checkins"]),1)
        self.assertEqual(s["doneDays"],0)
        self.assertEqual(self.store.events(NOW),[])

    def test_reflection_does_not_fabricate_adherence(self):
        f=self.focus()
        later=Rhythm([],now=NOW+timedelta(days=7))
        self.store.reflect({"focusId":f["id"],"note":"It was hard"},later)
        s=self.store.focus_state(later)
        self.assertEqual(s["reflection"],"It was hard")
        self.assertEqual(s["checkins"],[])

    def test_failed_renew_keeps_original_focus(self):
        f=self.focus()
        later=Rhythm([],now=NOW+timedelta(days=7))
        with self.assertRaises(ValueError):
            self.store.start_focus(f,later,renew_id=f["id"])
        self.assertEqual(self.store.active(NOW)["id"],f["id"])

    def test_cannot_check_in_before_focus_or_in_future(self):
        f=self.focus()
        for shift in (-1,1):
            with self.assertRaises(ValueError):
                self.store.checkin({"focusId":f["id"],"day":(NOW+timedelta(days=shift)).date().isoformat(),"status":"done"},self.rhythm)


class AITests(unittest.TestCase):
    def test_cloud_off_and_consent_required(self):
        with patch.dict(os.environ, {}, clear=True):
            ai=OrbitAI()
            self.assertFalse(ai.enabled())
            with self.assertRaises(AIUnavailable):
                ai.request('test','',[],{})
            with self.assertRaises(ValueError):
                ai.coach({"candidates":[]},False)

    def test_coach_refuses_medication_or_fabricated_statistics(self):
        for text in ['Increase your basal','Well done on 99% today','Try another bolus']:
            ai=OrbitAI()
            with patch.object(ai,'request',return_value={"question":text}):
                with self.assertRaises(AIUnavailable):
                    ai.coach({"candidates":[]},True)

    def test_coach_sends_no_notes_or_habit_or_credentials(self):
        ai=OrbitAI()
        state={"focus":{"reviewDue":False,"doneDays":3,"habit":"SECRET HABIT","note":"PRIVATE"},"candidates":[]}
        with patch.object(ai,'request',return_value={"question":"What feels manageable today?"}) as request:
            ai.coach(state,True)
            sent=json.dumps(request.call_args.args)
            self.assertNotIn('SECRET',sent)
            self.assertNotIn('PRIVATE',sent)


if __name__ == '__main__':
    unittest.main()
