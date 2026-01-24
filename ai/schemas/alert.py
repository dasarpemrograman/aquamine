from datetime import datetime
from typing import Optional, List
from pydantic import ConfigDict

from .base import BaseSchema


class AlertBase(BaseSchema):
    sensor_id: int
    severity: str  # warning, critical
    previous_state: Optional[str] = None
    message: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    id: int
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AnomalyBase(BaseSchema):
    sensor_id: int
    timestamp: datetime
    parameter: str
    value: float
    anomaly_score: Optional[float] = None
    detection_method: Optional[str] = None


class AnomalyCreate(AnomalyBase):
    pass


class AnomalyResponse(AnomalyBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecipientBase(BaseSchema):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    notify_warning: bool = True
    notify_critical: bool = True


class RecipientCreate(RecipientBase):
    pass


class RecipientResponse(RecipientBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
