from datetime import datetime
from typing import Optional

from pydantic import ConfigDict

from .base import BaseSchema


class UserSettingsResponse(BaseSchema):
    user_id: str
    notifications_enabled: bool = True
    notify_critical: bool = True
    notify_warning: bool = True
    notify_info: bool = False
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    timezone: str
    refresh_interval_seconds: int = 10
    last_notification_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserSettingsUpdate(BaseSchema):
    notifications_enabled: Optional[bool] = None
    notify_critical: Optional[bool] = None
    notify_warning: Optional[bool] = None
    notify_info: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    timezone: Optional[str] = None
    refresh_interval_seconds: Optional[int] = None
    last_notification_seen_at: Optional[datetime] = None
