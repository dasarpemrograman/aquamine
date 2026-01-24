from datetime import datetime
from typing import Optional
from pydantic import ConfigDict, computed_field

from .base import BaseSchema

__all__: list[str] = [
    "SensorBase",
    "SensorCreate",
    "SensorResponse",
    "ReadingBase",
    "ReadingCreate",
    "ReadingResponse",
    "SensorDataIngest",
]


class SensorBase(BaseSchema):
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


class ReadingBase(BaseSchema):
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

    @computed_field
    @property
    def ph_level(self) -> Optional[float]:
        return self.ph


class SensorDataIngest(BaseSchema):
    sensor_id: str
    timestamp: datetime
    location: Optional[dict[str, float]] = None  # {lat: float, lon: float}
    readings: dict[str, float | None]  # {ph: float, turbidity: float, temperature: float}
    metadata: Optional[dict[str, float | int]] = (
        None  # {battery_voltage: float, signal_strength: int}
    )
