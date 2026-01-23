from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AlertAnomalyItem(BaseModel):
    sensor_id: str
    parameter: str
    value: float
    severity: str
    severity_score: int
    reason: str


class AlertRequest(BaseModel):
    anomalies: list[AlertAnomalyItem]
    notify: bool = True


class StateChange(BaseModel):
    sensor_id: str
    old_state: str
    new_state: str


class NotificationResult(BaseModel):
    whatsapp: bool
    email: bool
    errors: list[str]


class AlertResponse(BaseModel):
    processed: int
    notifications_sent: NotificationResult
    state_changes: list[StateChange]


class AlertStatesResponse(BaseModel):
    alert_states: dict[str, str]
    last_updated: Optional[datetime] = None
