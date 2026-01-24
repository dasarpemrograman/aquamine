from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, field_serializer


def format_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


class BaseSchema(BaseModel):
    @field_serializer("*", check_fields=False)
    def serialize_datetimes(self, value: Any):
        if isinstance(value, datetime):
            return format_datetime(value)
        return value
