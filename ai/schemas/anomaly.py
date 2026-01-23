from datetime import datetime
from pydantic import BaseModel


class SensorDataPoint(BaseModel):
    timestamp: datetime
    sensor_id: str
    ph: float
    turbidity: float
    conductivity: float
    temperature: float


class AnomalyRequest(BaseModel):
    data: list[SensorDataPoint]


class AnomalyItem(BaseModel):
    timestamp: datetime
    sensor_id: str
    parameter: str
    value: float
    severity: str
    severity_score: int
    reason: str


class AnomalyResponse(BaseModel):
    anomalies: list[AnomalyItem]
    total_anomalies: int
    method: str = "threshold"
