import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..db.models import Sensor, Reading
from ..schemas.sensor import SensorDataIngest
from ..db.connection import AsyncSessionLocal
from .config import mqtt_config

logger = logging.getLogger(__name__)


async def process_mqtt_message(
    payload: SensorDataIngest,
    session: Optional[AsyncSession] = None,
    source: str = "unknown",
):
    """
    Process incoming MQTT message:
    1. Auto-register sensor if new
    2. Store readings in TimescaleDB
    """
    if session:
        return await _process_mqtt_logic(session, payload, source=source)

    async with AsyncSessionLocal() as local_session:
        try:
            processed = await _process_mqtt_logic(local_session, payload, source=source)
            if not processed:
                await local_session.rollback()
                return False
            await local_session.commit()
            return processed
        except Exception as e:
            await local_session.rollback()
            logger.error(f"Error processing telemetry message from {source}: {e}")
            raise e


async def _process_mqtt_logic(session: AsyncSession, payload: SensorDataIngest, source: str):
    allowed_sensor_ids = mqtt_config.allowed_sensor_ids
    if allowed_sensor_ids and payload.sensor_id not in allowed_sensor_ids:
        logger.warning(
            "Dropping reading source=%s sensor_id=%s because it is outside SENSOR_ALLOWED_IDS",
            source,
            payload.sensor_id,
        )
        return False

    # Check if sensor exists
    result = await session.execute(select(Sensor).where(Sensor.sensor_id == payload.sensor_id))
    sensor = result.scalar_one_or_none()

    # Auto-register if not found
    if not sensor:
        if not mqtt_config.auto_register_unknown:
            logger.warning(
                "Dropping reading source=%s sensor_id=%s because SENSOR_AUTO_REGISTER_UNKNOWN=false",
                source,
                payload.sensor_id,
            )
            return False
        logger.info(f"Auto-registering new sensor: {payload.sensor_id}")
        sensor = Sensor(
            sensor_id=payload.sensor_id,
            name=f"Sensor {payload.sensor_id}",
            latitude=payload.location.get("lat") if payload.location else None,
            longitude=payload.location.get("lon") if payload.location else None,
            is_active=True,
        )
        session.add(sensor)
        await session.flush()  # Get ID

    # Store reading
    reading = Reading(
        sensor_id=sensor.id,
        timestamp=payload.timestamp,
        ph=payload.readings.get("ph"),
        turbidity=payload.readings.get("turbidity"),
        temperature=payload.readings.get("temperature"),
        battery_voltage=payload.metadata.get("battery_voltage") if payload.metadata else None,
        signal_strength=payload.metadata.get("signal_strength") if payload.metadata else None,
    )
    session.add(reading)
    logger.info(
        "Stored reading source=%s sensor_id=%s timestamp=%s",
        source,
        payload.sensor_id,
        payload.timestamp,
    )
    return True
