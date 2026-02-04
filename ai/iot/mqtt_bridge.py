import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..db.models import Sensor, Reading
from ..schemas.sensor import SensorDataIngest
from ..db.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def process_mqtt_message(payload: SensorDataIngest, session: Optional[AsyncSession] = None):
    """
    Process incoming MQTT message:
    1. Auto-register sensor if new
    2. Store readings in TimescaleDB
    """
    if session:
        return await _process_mqtt_logic(session, payload)

    async with AsyncSessionLocal() as local_session:
        try:
            await _process_mqtt_logic(local_session, payload)
            await local_session.commit()
            return True
        except Exception as e:
            await local_session.rollback()
            logger.error(f"Error processing MQTT message: {e}")
            raise e


async def _process_mqtt_logic(session: AsyncSession, payload: SensorDataIngest):
    # Check if sensor exists
    result = await session.execute(select(Sensor).where(Sensor.sensor_id == payload.sensor_id))
    sensor = result.scalar_one_or_none()

    # Auto-register if not found
    if not sensor:
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
    logger.info(f"Stored reading for {payload.sensor_id} at {payload.timestamp}")
    return True
