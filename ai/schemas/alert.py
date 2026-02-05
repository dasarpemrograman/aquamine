from datetime import datetime
from typing import Optional, Any
from pydantic import ConfigDict

from .base import BaseSchema


class AlertBase(BaseSchema):
    sensor_id: int
    severity: str
    previous_state: Optional[str] = None
    message: Optional[str] = None


class AlertCreate(AlertBase):
    pass


class AlertResolveRequest(BaseSchema):
    resolution_note: Optional[str] = None


class AlertEvidenceBase(BaseSchema):
    alert_id: int
    image_data: str
    analysis_result: Optional[dict[str, Any]] = None
    attached_by: Optional[str] = None


class AlertEvidenceCreate(AlertEvidenceBase):
    pass


class AlertEvidenceResponse(AlertEvidenceBase):
    id: int
    attached_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertResponse(AlertBase):
    id: int
    sensor_name: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None
    reopened_at: Optional[datetime] = None
    reopened_by: Optional[str] = None
    evidence_count: int = 0

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
