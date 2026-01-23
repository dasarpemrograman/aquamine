from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class SensorBase(BaseModel):
    sensor_id: str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool = True


class SensorCreate(SensorBase):
    pass


class SensorResponse(SensorBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadingBase(BaseModel):
    timestamp: datetime
    ph: Optional[float] = None
    turbidity: Optional[float] = None
    temperature: Optional[float] = None
    battery_voltage: Optional[float] = None
    signal_strength: Optional[int] = None


class ReadingCreate(ReadingBase):
    sensor_id: int


class ReadingResponse(ReadingBase):
    id: int
    sensor_id: int

    model_config = ConfigDict(from_attributes=True)


class SensorDataIngest(BaseModel):
    sensor_id: str
    timestamp: datetime
    location: Optional[dict] = None  # {lat: float, lon: float}
    readings: dict  # {ph: float, turbidity: float, temperature: float}
    metadata: Optional[dict] = None  # {battery_voltage: float, signal_strength: int}
