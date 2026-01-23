from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AlertCreate(BaseModel):
    sensor_id: int
    severity: str = Field(..., pattern="^(warning|critical)$")
    previous_state: Optional[str] = Field(None, pattern="^(normal|warning|critical)$")
    message: Optional[str] = None


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    severity: str
    previous_state: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None


class AlertAcknowledge(BaseModel):
    acknowledged_by: str = Field(..., min_length=1, max_length=100)


class AlertSummary(BaseModel):
    total_alerts: int
    warning_count: int
    critical_count: int
    unacknowledged_count: int
    max_severity: Optional[str] = None


class NotificationRecipientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    is_active: bool = True
    notify_warning: bool = True
    notify_critical: bool = True


class NotificationRecipientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    notify_warning: bool
    notify_critical: bool


class SensorAlertStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sensor_id: int
    current_state: str
    last_alert_at: Optional[datetime] = None
    last_notification_at: Optional[datetime] = None
