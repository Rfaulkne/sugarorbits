"""Synthetic, in-memory preview data. Never added to a user's glucose archive."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def demo_records(now=None, tz="Europe/Berlin"):
    now = now or datetime.now(timezone.utc)
    zone = ZoneInfo(tz)
    records = []
    for step in range(15 * 288):
        at = now - timedelta(minutes=5 * step)
        local = at.astimezone(zone)
        hour = local.hour + local.minute / 60
        day = (now.astimezone(zone).date() - local.date()).days
        lunch = math.exp(-((hour - 13.5) / 1.0) ** 2)
        supper = math.exp(-((hour - 20.1) / 1.25) ** 2)
        low = math.exp(-((hour - 4) / .6) ** 2)
        value = 6.8 + .45 * math.sin(hour * 1.3 + day) + (.7 if day < 8 else 0) * lunch
        value += (4.7 if day % 3 else 1.6) * lunch + 2.2 * supper - (3.6 if day % 4 == 0 else .4) * low
        value = round(value, 2)
        records.append({"systemTime": at.isoformat(), "valueMmol": value})
    return records
