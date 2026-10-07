from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC timestamp. SQLite has no timezone type, so we store UTC and
    re-attach the timezone when serializing (see schemas/common.py)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
