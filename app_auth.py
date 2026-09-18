from __future__ import annotations

import hashlib
import hmac
import time


SESSION_TTL_SECONDS = 60 * 60 * 24 * 30


def create_session_value(secret: str, now: int | None = None) -> str:
    issued_at = int(time.time() if now is None else now)
    expires_at = issued_at + SESSION_TTL_SECONDS
    payload = str(expires_at)
    signature = hmac.new(
        secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return f"{payload}.{signature}"


def verify_session_value(value: str, secret: str, now: int | None = None) -> bool:
    if not value or not secret:
        return False
    try:
        expires_text, supplied_signature = value.split(".", 1)
        expires_at = int(expires_text)
    except (ValueError, TypeError):
        return False
    current_time = int(time.time() if now is None else now)
    if expires_at <= current_time:
        return False
    expected_signature = hmac.new(
        secret.encode("utf-8"), expires_text.encode("ascii"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(supplied_signature, expected_signature)


def access_code_matches(submitted: str, expected: str) -> bool:
    return bool(submitted and expected) and hmac.compare_digest(submitted, expected)
