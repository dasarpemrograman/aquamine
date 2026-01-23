from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ForecastPoint(BaseModel):
    timestamp: datetime
    value: float
    lower: Optional[float] = None
    upper: Optional[float] = None


class ForecastCreate(BaseModel):
    sensor_id: int
    forecast_start: datetime
    forecast_end: datetime
    parameter: str = Field(..., pattern="^(ph|turbidity|temperature)$")
    forecast_values: list[ForecastPoint]
    model_version: Optional[str] = None


class ForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    created_at: datetime
    forecast_start: datetime
    forecast_end: datetime
    parameter: str
    forecast_values: list[ForecastPoint]
    model_version: Optional[str] = None


class AnomalyCreate(BaseModel):
    sensor_id: int
    timestamp: datetime
    parameter: str = Field(..., pattern="^(ph|turbidity|temperature)$")
    value: float
    anomaly_score: Optional[float] = Field(None, ge=0, le=10)
    detection_method: Optional[str] = Field(None, pattern="^(timegpt|threshold)$")


class AnomalyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    timestamp: datetime
    parameter: str
    value: float
    anomaly_score: Optional[float] = None
    detection_method: Optional[str] = None
    created_at: datetime
