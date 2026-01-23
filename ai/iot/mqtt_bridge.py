from datetime import datetime, timezone
import json
from typing import Any

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from db.models import Sensor, Reading


class PayloadParseError(Exception):
    pass


class MQTTPayload(BaseModel):
    sensor_id: str
    timestamp: datetime
    location: dict[str, float] | None = None
    readings: dict[str, float]
    metadata: dict[str, float | int] | None = None


def parse_mqtt_payload(raw_payload: str) -> MQTTPayload:
    try:
        data = json.loads(raw_payload)
    except json.JSONDecodeError as e:
        raise PayloadParseError(f"Invalid JSON: {e}")

    try:
        return MQTTPayload(**data)
    except ValidationError as e:
        raise PayloadParseError(f"Validation error: {e}")


def get_or_create_sensor(
    session: Session,
    sensor_id: str,
    name: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> Sensor:
    sensor = session.query(Sensor).filter(Sensor.sensor_id == sensor_id).first()

    if sensor is None:
        sensor = Sensor(
            sensor_id=sensor_id,
            name=name or f"Auto-registered: {sensor_id}",
            latitude=latitude,
            longitude=longitude,
        )
        session.add(sensor)
        session.commit()

    return sensor


def store_reading(
    session: Session,
    sensor_id: int,
    timestamp: datetime,
    ph: float | None = None,
    turbidity: float | None = None,
    temperature: float | None = None,
    battery_voltage: float | None = None,
    signal_strength: int | None = None,
) -> Reading:
    reading = Reading(
        sensor_id=sensor_id,
        timestamp=timestamp,
        ph=ph,
        turbidity=turbidity,
        temperature=temperature,
        battery_voltage=battery_voltage,
        signal_strength=signal_strength,
    )
    session.add(reading)
    session.commit()
    return reading


def process_mqtt_message(session: Session, raw_payload: str) -> dict[str, Any]:
    try:
        payload = parse_mqtt_payload(raw_payload)
    except PayloadParseError as e:
        return {"success": False, "error": str(e)}

    lat = payload.location.get("lat") if payload.location else None
    lon = payload.location.get("lon") if payload.location else None

    sensor = get_or_create_sensor(
        session,
        sensor_id=payload.sensor_id,
        name=f"Sensor {payload.sensor_id}",
        latitude=lat,
        longitude=lon,
    )

    battery_v = None
    signal_str = None
    if payload.metadata:
        battery_v = payload.metadata.get("battery_voltage")
        signal_str_raw = payload.metadata.get("signal_strength")
        signal_str = int(signal_str_raw) if signal_str_raw is not None else None

    reading = store_reading(
        session,
        sensor_id=sensor.id,
        timestamp=payload.timestamp,
        ph=payload.readings.get("ph"),
        turbidity=payload.readings.get("turbidity"),
        temperature=payload.readings.get("temperature"),
        battery_voltage=battery_v,
        signal_strength=signal_str,
    )

    return {
        "success": True,
        "sensor_id": payload.sensor_id,
        "reading_id": reading.id,
        "timestamp": payload.timestamp.isoformat(),
    }
