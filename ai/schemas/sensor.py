from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SensorBase(BaseModel):
    sensor_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class SensorCreate(SensorBase):
    pass


class SensorResponse(SensorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    is_active: bool


class ReadingBase(BaseModel):
    ph: Optional[float] = Field(None, ge=0, le=14)
    turbidity: Optional[float] = Field(None, ge=0)
    temperature: Optional[float] = Field(None, ge=-50, le=100)
    battery_voltage: Optional[float] = Field(None, ge=0, le=5)
    signal_strength: Optional[int] = Field(None, ge=-120, le=0)


class ReadingCreate(ReadingBase):
    sensor_id: int
    timestamp: datetime


class ReadingResponse(ReadingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_id: int
    timestamp: datetime


class MQTTPayload(BaseModel):
    sensor_id: str
    timestamp: datetime
    location: Optional[dict[str, float]] = None
    readings: dict[str, float]
    metadata: Optional[dict[str, float | int]] = None
