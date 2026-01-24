from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import ConfigDict

from .base import BaseSchema


class ForecastPoint(BaseSchema):
    timestamp: datetime
    value: float
    lower: Optional[float] = None
    upper: Optional[float] = None


class PredictionBase(BaseSchema):
    sensor_id: int
    forecast_start: datetime
    forecast_end: datetime
    parameter: str  # ph, turbidity, temperature
    model_version: Optional[str] = None
    forecast_values: List[ForecastPoint]


class PredictionCreate(PredictionBase):
    pass


class PredictionResponse(PredictionBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
