"""Local, auditable rhythm analysis and a small habit/event archive.

No network calls, treatment suggestions, or inferred causes live in this module.
All clock-time analysis uses the configured IANA timezone, not the browser zone.
"""
from __future__ import annotations

import json
import math
import sqlite3
import statistics
import threading
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

UTC = timezone.utc
KINDS = {"activity", "stress", "other", "food"}
CHECKINS = {"done", "partly", "not_today"}


def instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("A timestamp must include its timezone")
    return parsed.astimezone(UTC)


def bounded_text(value, limit=160):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError(f"Text must be at most {limit} characters")
    return value.strip()


def mean(values):
    return round(statistics.mean(values), 2) if values else None


def dates_before(today, days):
    return [today - timedelta(days=n) for n in range(days, 0, -1)]


class Rhythm:
    """Five-minute slots prevent duplicate/dense samples gaining extra weight."""

    def __init__(self, records, tz="Europe/Berlin", now=None):
        self.zone = ZoneInfo(tz)
        self.now = (now or datetime.now(UTC)).astimezone(UTC)
        self.today = self.now.astimezone(self.zone).date()
        self.expected = {}
        self.slots = {}
        for record in records:
            try:
                stamp = instant(record["systemTime"])
                value = float(record["valueMmol"])
                if not math.isfinite(value) or not 1 <= value <= 40 or stamp > self.now:
                    continue
                # UTC slot is unique even during the repeated DST hour.
                key = int(stamp.timestamp()) // 300
                self.slots[key] = (stamp, value)
            except (ValueError, KeyError, TypeError):
                continue
        self.days = {}
        for stamp, value in sorted(self.slots.values()):
            local = stamp.astimezone(self.zone)
            self.days.setdefault(local.date(), []).append((stamp, value, local.hour * 60 + local.minute))

    def bounds(self, day, start=0, end=1440):
        midnight = datetime.combine(day, time(), self.zone)
        return (midnight + timedelta(minutes=start)).astimezone(UTC), (midnight + timedelta(minutes=end)).astimezone(UTC)

    def expected_slots(self, day, start, end):
        if day not in self.expected:
            begin, finish = self.bounds(day)
            counts = [0] * 48
            stamp = begin
            while stamp < finish:
                local = stamp.astimezone(self.zone)
                counts[(local.hour * 60 + local.minute) // 30] += 1
                stamp += timedelta(minutes=5)
            self.expected[day] = counts
        return sum(self.expected[day][start // 30:end // 30])

    def window(self, days, start, end, after=None):
        rows = []
        for day in days:
            begin, finish = self.bounds(day, start, end)
            # Never compare a partial future/current window with a complete one.
            if finish > self.now or (after and begin < after):
                continue
            expected = self.expected_slots(day, start, end)
            points = [(stamp, v) for stamp, v, m in self.days.get(day, []) if start <= m < end]
            coverage = min(1, len(points) / expected) if expected else 0
            if coverage < .7:
                continue
            values = [v for _, v in points]
            # Fifteen observed consecutive minutes, not isolated outliers.
            runs = {"high": 0, "low": 0}
            affected = {"high": False, "low": False}
            previous = None
            for stamp, value in points:
                continuous = previous is not None and (stamp - previous).total_seconds() <= 450
                for kind, outside in (("high", value > 10), ("low", value < 3.9)):
                    runs[kind] = (runs[kind] + 1 if continuous else 1) if outside else 0
                    affected[kind] |= runs[kind] >= 3
                previous = stamp
            rows.append({"date": day.isoformat(), "mean": mean(values),
                         "highFraction": sum(v > 10 for v in values) / len(values),
                         "lowFraction": sum(v < 3.9 for v in values) / len(values),
                         "coverage": coverage, "high": affected["high"], "low": affected["low"]})
        valid = len(rows)
        return {"validDays": valid, "expectedDays": len(days), "dates": [r["date"] for r in rows],
                "highDays": sum(r["high"] for r in rows), "lowDays": sum(r["low"] for r in rows),
                "mean": mean([r["mean"] for r in rows]),
                "highFraction": mean([r["highFraction"] for r in rows]),
                "lowFraction": mean([r["lowFraction"] for r in rows]),
                "meanCoverage": mean([r["coverage"] for r in rows])}

    def profile(self, days):
        bins = []
        for i in range(48):
            daily = []
            for day in days:
                values = [v for _, v, minute in self.days.get(day, []) if i * 30 <= minute < (i + 1) * 30]
                expected = self.expected_slots(day, i * 30, (i + 1) * 30)
                if expected > 0 and len(values) >= expected * .7:
                    daily.append(values)
            enough = len(daily) >= 3
            bins.append({"minute": i * 30 + 15, "validDays": len(daily),
                         "mean": mean([statistics.mean(v) for v in daily]) if enough else None,
                         "highFraction": mean([sum(x > 10 for x in v) / len(v) for v in daily]) if enough else None,
                         "lowFraction": mean([sum(x < 3.9 for x in v) / len(v) for v in daily]) if enough else None})
        return bins

    def candidates(self):
        days = dates_before(self.today, 7)
        candidates = []
        for start in range(0, 1440, 180):
            stats = self.window(days, start, start + 180)
            for kind in ("low", "high"):
                count = stats[kind + "Days"]
                if count < 3:
                    continue
                candidates.append({"id": f"{kind}-{start}", "kind": kind, "start": start,
                                   "end": start + 180, "stats": stats,
                                   "label": f"{'Lows' if kind == 'low' else 'Highs'} · {clock(start)}–{clock(start + 180)}"})
        return sorted(candidates, key=lambda c: (c["kind"] != "low", -c["stats"][c["kind"] + "Days"]))[:6]

    def state(self):
        week = dates_before(self.today, 7)
        previous = [d - timedelta(days=7) for d in week]
        days = []
        for day in [self.today - timedelta(days=i) for i in range(6, -1, -1)]:
            points = self.days.get(day, [])
            values = [v for _, v, _ in points]
            begin, finish = self.bounds(day)
            expected = max(1, (min(self.now, finish) - begin).total_seconds() / 300)
            days.append({"date": day.isoformat(), "partial": day == self.today,
                         "coverage": round(min(1, len(values) / expected), 2),
                         "mean": mean(values), "tir": round(100 * sum(3.9 <= v <= 10 for v in values) / len(values)) if values else None,
                         "points": [{"minute": m, "value": v} for _, v, m in points]})
        latest = max((s for s, _ in self.slots.values()), default=None)
        return {"timezone": str(self.zone), "today": self.today.isoformat(), "now": self.now.isoformat(),
                "clockMinute": self.now.astimezone(self.zone).hour * 60 + self.now.astimezone(self.zone).minute,
                "lastReadingAt": latest.isoformat() if latest else None,
                "stale": latest is None or (self.now - latest).total_seconds() > 1200,
                "weekStart": week[0].isoformat(), "weekEnd": week[-1].isoformat(),
                "profile": self.profile(week), "previousProfile": self.profile(previous),
                "weekStats": self.window(week, 0, 1440), "days": days, "candidates": self.candidates()}


def clock(minute):
    return f"{minute // 60:02d}:{minute % 60:02d}"


class FocusStore:
    def __init__(self, data_dir: Path):
        self.path = data_dir / "context.sqlite3"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL,
                    note TEXT NOT NULL, carbs REAL, created TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS focuses(id TEXT PRIMARY KEY, payload TEXT NOT NULL,
                    created TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_focus ON focuses(active) WHERE active=1;
                CREATE TABLE IF NOT EXISTS checkins(focus_id TEXT NOT NULL, day TEXT NOT NULL, status TEXT NOT NULL,
                    note TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(focus_id, day));
                CREATE TABLE IF NOT EXISTS reflections(focus_id TEXT PRIMARY KEY, note TEXT NOT NULL, updated TEXT NOT NULL);
            """)

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def prune(self, now=None):
        now = now or datetime.now(UTC)
        cutoff = (now - timedelta(days=28)).isoformat()
        with self.lock, self.connect() as db:
            db.execute("DELETE FROM events WHERE at < ?", (cutoff,))
            db.execute("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY at DESC, created DESC LIMIT 20)")
            db.execute("DELETE FROM focuses WHERE created < ?", (cutoff,))
            db.execute("DELETE FROM checkins WHERE updated < ? OR focus_id NOT IN (SELECT id FROM focuses)", (cutoff,))
            db.execute("DELETE FROM reflections WHERE updated < ? OR focus_id NOT IN (SELECT id FROM focuses)", (cutoff,))

    def events(self, now=None):
        self.prune(now)
        with self.lock, self.connect() as db:
            return [dict(r) for r in db.execute("SELECT id, at, kind, note, carbs FROM events ORDER BY at DESC, created DESC")]

    def add_event(self, payload, now=None):
        now = now or datetime.now(UTC)
        event_id = str(uuid.UUID(str(payload.get("id", ""))))
        at = instant(payload.get("at", now.isoformat()))
        if at < now - timedelta(days=28) or at > now + timedelta(minutes=5):
            raise ValueError("Event must be within the past 28 days, not in the future")
        kind = payload.get("kind")
        if kind not in KINDS:
            raise ValueError("Choose activity, stress, food, or other")
        note = bounded_text(payload.get("note", ""))
        carbs = payload.get("carbs")
        if carbs is not None and (isinstance(carbs, bool) or not isinstance(carbs, (int, float)) or not math.isfinite(carbs) or not 0 <= carbs <= 500):
            raise ValueError("Confirmed carbohydrate grams must be between 0 and 500")
        if carbs is not None and kind != "food":
            raise ValueError("Carbohydrate values belong only to food events")
        with self.lock, self.connect() as db:
            db.execute("INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)", (event_id, at.isoformat(), kind, note, carbs, now.isoformat()))
        self.prune(now)
        return event_id

    def delete_event(self, event_id):
        with self.lock, self.connect() as db:
            db.execute("DELETE FROM events WHERE id=?", (str(uuid.UUID(event_id)),))

    def active(self, now=None):
        self.prune(now)
        with self.lock, self.connect() as db:
            row = db.execute("SELECT payload FROM focuses WHERE active=1").fetchone()
            return json.loads(row[0]) if row else None

    def start_focus(self, payload, rhythm, renew_id=None):
        start, end = payload.get("start"), payload.get("end")
        if type(start) is not int or type(end) is not int or not 0 <= start < end <= 1440 or start % 30 or end % 30 or end - start < 30:
            raise ValueError("Choose a clock window of at least 30 minutes within one day")
        habit = bounded_text(payload.get("habit", ""), 120)
        if not habit:
            raise ValueError("Name a habit, or choose 'Simply observe this period'")
        kind = payload.get("kind", "observe")
        if kind not in {"high", "low", "observe"}:
            raise ValueError("Invalid focus kind")
        baseline = rhythm.window(dates_before(rhythm.today, 7), start, end)
        if baseline["validDays"] < 3:
            raise ValueError("This period needs at least three days with sufficient readings before starting a comparison")
        focus = {"id": str(uuid.uuid4()), "start": start, "end": end, "habit": habit, "kind": kind,
                 "startedAt": rhythm.now.isoformat(), "reviewAt": (rhythm.now + timedelta(days=7)).isoformat(),
                 "baseline": baseline, "timezone": str(rhythm.zone)}
        with self.lock, self.connect() as db:
            existing = db.execute("SELECT id FROM focuses WHERE active=1").fetchone()
            if renew_id and (not existing or existing["id"] != renew_id):
                raise ValueError("No matching active focus to renew")
            if existing and not renew_id:
                raise ValueError("Finish or stop your current focus before starting another")
            if renew_id:
                db.execute("UPDATE focuses SET active=0 WHERE id=?", (renew_id,))
            db.execute("INSERT INTO focuses VALUES(?,?,?,1)", (focus["id"], json.dumps(focus), rhythm.now.isoformat()))
        return focus

    def checkin(self, payload, rhythm):
        focus = self.active(rhythm.now)
        if not focus or payload.get("focusId") != focus["id"]:
            raise ValueError("No matching active focus")
        day = date.fromisoformat(payload.get("day", ""))
        first = instant(focus["startedAt"]).astimezone(rhythm.zone).date()
        if day < first or day > rhythm.today:
            raise ValueError("Choose a day since the focus began, not a future day")
        status = payload.get("status")
        if status not in CHECKINS:
            raise ValueError("Choose done, partly, or not today")
        note = bounded_text(payload.get("note", ""))
        with self.lock, self.connect() as db:
            db.execute("INSERT INTO checkins VALUES(?,?,?,?,?) ON CONFLICT(focus_id,day) DO UPDATE SET status=excluded.status,note=excluded.note,updated=excluded.updated",
                       (focus["id"], day.isoformat(), status, note, rhythm.now.isoformat()))

    def finish(self, focus_id):
        with self.lock, self.connect() as db:
            db.execute("UPDATE focuses SET active=0 WHERE id=?", (str(uuid.UUID(focus_id)),))

    def reflect(self, payload, rhythm):
        focus = self.active(rhythm.now)
        if not focus or payload.get("focusId") != focus["id"] or rhythm.now < instant(focus["reviewAt"]):
            raise ValueError("No matching focus ready for review")
        note = bounded_text(payload.get("note", ""))
        with self.lock, self.connect() as db:
            db.execute("INSERT INTO reflections VALUES(?,?,?) ON CONFLICT(focus_id) DO UPDATE SET note=excluded.note,updated=excluded.updated", (focus["id"], note, rhythm.now.isoformat()))

    def focus_state(self, rhythm):
        focus = self.active(rhythm.now)
        if not focus:
            return None
        with self.lock, self.connect() as db:
            focus["checkins"] = [dict(r) for r in db.execute("SELECT day,status,note FROM checkins WHERE focus_id=? ORDER BY day", (focus["id"],))]
            row = db.execute("SELECT note FROM reflections WHERE focus_id=?", (focus["id"],)).fetchone()
            focus["reflection"] = row[0] if row else None
        first = instant(focus["startedAt"]).astimezone(rhythm.zone).date()
        # Freeze the evaluation to the first week even if the review is opened late.
        days = [first + timedelta(days=i) for i in range(8)]
        limit = instant(focus["reviewAt"])
        days = [d for d in days if rhythm.bounds(d, focus["start"], focus["end"])[1] <= limit
                and rhythm.bounds(d, focus["start"], focus["end"])[0] >= instant(focus["startedAt"])]
        followup = rhythm.window(days, focus["start"], focus["end"], after=instant(focus["startedAt"]))
        focus["followup"] = followup
        focus["reviewDue"] = rhythm.now >= limit
        focus["elapsedDays"] = min(7, max(0, int((rhythm.now - instant(focus["startedAt"])).total_seconds() // 86400)))
        focus["enoughToCompare"] = focus["reviewDue"] and min(focus["baseline"]["validDays"], followup["validDays"]) >= 5
        focus["doneDays"] = sum(c["status"] == "done" for c in focus["checkins"])
        return focus


def guide(state):
    focus = state.get("focus")
    if focus:
        if focus["reviewDue"]:
            text = "Your seven-day review is ready. What felt realistic, and what would you like to keep?"
            if not focus["enoughToCompare"]:
                text = "Your review is ready, but there aren't enough comparable days to judge the glucose pattern. How did the habit feel?"
        else:
            text = "One small focus is enough. How did your chosen habit fit into today?"
        return {"source": "local", "question": text}
    if state["candidates"]:
        c = state["candidates"][0]
        n = c["stats"][c["kind"] + "Days"]
        return {"source": "local", "question": f"{c['label']} appeared on {n} of {c['stats']['validDays']} covered days. Is this a period you'd like to give some attention to?"}
    return {"source": "local", "question": "No repeated out-of-range window meets the evidence threshold yet. You can keep observing, or choose a period that matters to you."}
