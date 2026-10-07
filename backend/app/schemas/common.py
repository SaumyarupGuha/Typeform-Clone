from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer


def _as_utc_iso(value: datetime) -> str:
    # The database stores naive UTC; adding the timezone makes browsers parse it correctly.
    return value.replace(tzinfo=timezone.utc).isoformat()


UtcDatetime = Annotated[datetime, PlainSerializer(_as_utc_iso, return_type=str)]
