from datetime import datetime
from pydantic import BaseModel


class SensorDataPoint(BaseModel):
    timestamp: datetime
    sensor_id: str
    ph: float
    turbidity: float
    conductivity: float
    temperature: float


class ForecastRequest(BaseModel):
    data: list[SensorDataPoint]
    horizon_days: int = 7


class ForecastPoint(BaseModel):
    timestamp: datetime
    sensor_id: str
    parameter: str
    predicted: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    forecasts: list[ForecastPoint]
    horizon_days: int
    data_points: int
