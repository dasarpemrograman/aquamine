import asyncio
import logging
from typing import Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..db.models import Sensor, Reading, SensorAlertState, Anomaly, Alert, NotificationRecipient
from ..schemas.sensor import SensorDataIngest
from ..schemas.alert import AlertCreate, RecipientBase, RecipientResponse
from ..db.connection import AsyncSessionLocal
from ..anomaly.detector import AnomalyDetector
from ..alerts.state_machine import AlertStateMachine
from ..alerts.notifications import NotificationService
from ..realtime.websocket import manager as ws_manager
from .sensor_calibration import sensor_calibration

logger = logging.getLogger(__name__)

_anomaly_detector = AnomalyDetector()
_alert_sm = AlertStateMachine()
_notifier = NotificationService()


async def process_mqtt_message(payload: SensorDataIngest, session: Optional[AsyncSession] = None):
    """
    Process incoming MQTT message:
    1. Auto-register sensor if new
    2. Store readings in TimescaleDB
    3. (MQTT path only) Run anomaly detection and alert processing

    When called with a session (from the HTTP ingest endpoint), only steps 1-2
    run — the caller handles alerts separately.
    """
    if session:
        return await _process_mqtt_logic(session, payload)

    async with AsyncSessionLocal() as local_session:
        try:
            calibrated_readings = await _process_mqtt_logic(local_session, payload)

            result = await local_session.execute(
                select(Sensor).where(Sensor.sensor_id == payload.sensor_id)
            )
            sensor = result.scalar_one_or_none()
            if sensor:
                await _process_reading_alerts(local_session, sensor, payload, calibrated_readings)

            await local_session.commit()

            await ws_manager.publish_update("sensor_reading", payload.model_dump(mode="json"))

            return True
        except Exception as e:
            await local_session.rollback()
            logger.error(f"Error processing MQTT message: {e}")
            raise e


async def _process_mqtt_logic(session: AsyncSession, payload: SensorDataIngest):
    result = await session.execute(select(Sensor).where(Sensor.sensor_id == payload.sensor_id))
    sensor = result.scalar_one_or_none()

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
        await session.flush()

    calibrated_readings = sensor_calibration.calibrate_readings(
        payload.readings, sensor_id=payload.sensor_id
    )

    reading = Reading(
        sensor_id=sensor.id,
        timestamp=payload.timestamp,
        ph=calibrated_readings.get("ph"),
        turbidity=calibrated_readings.get("turbidity"),
        temperature=calibrated_readings.get("temperature"),
        battery_voltage=payload.metadata.get("battery_voltage") if payload.metadata else None,
        signal_strength=payload.metadata.get("signal_strength") if payload.metadata else None,
    )
    session.add(reading)
    logger.info(f"Stored reading for {payload.sensor_id} at {payload.timestamp}")
    return calibrated_readings


async def _process_reading_alerts(
    session: AsyncSession,
    sensor: Sensor,
    payload: SensorDataIngest,
    calibrated_readings: Dict[str, Optional[float]],
):
    """Run anomaly detection, alert state machine, notifications, and WebSocket broadcast.

    This is the same pipeline that the HTTP ingest endpoint runs inline.
    It closes the gap where MQTT-originated readings were silently stored
    without ever triggering alerts.

    Uses calibrated_readings (not raw payload.readings) so thresholds
    compare against proper NTU/pH values rather than raw ADC output.
    """
    stmt = select(SensorAlertState).where(SensorAlertState.sensor_id == sensor.id)
    result = await session.execute(stmt)
    db_state = result.scalar_one_or_none()

    if not db_state:
        db_state = SensorAlertState(sensor_id=sensor.id, current_state="normal")
        session.add(db_state)

    anomalies = _anomaly_detector.detect_threshold_anomalies(
        sensor.id,
        {key: value for key, value in calibrated_readings.items() if value is not None},
        payload.timestamp,
    )

    if anomalies:
        for anom in anomalies:
            db_anomaly = Anomaly(
                sensor_id=anom.sensor_id,
                timestamp=anom.timestamp,
                parameter=anom.parameter,
                value=anom.value,
                anomaly_score=anom.anomaly_score,
                detection_method=anom.detection_method,
            )
            session.add(db_anomaly)

            severity = "critical" if "critical" in (anom.detection_method or "") else "warning"
            message = f"{anom.parameter.upper()} {severity}: {anom.value:.2f}"

            alert, new_state, new_last_alert_at = _alert_sm.process_anomaly(
                sensor_id=sensor.id,
                severity=severity,
                message=message,
                current_state=db_state.current_state,
                last_alert_at=db_state.last_alert_at,
            )
            if alert:
                db_alert = Alert(
                    sensor_id=alert.sensor_id,
                    severity=alert.severity,
                    previous_state=alert.previous_state,
                    message=alert.message,
                )
                session.add(db_alert)

                db_state.current_state = new_state
                db_state.last_alert_at = new_last_alert_at

                await _send_alert_notifications(session, db_alert, alert)
    else:
        # No anomalies — check for recovery back to normal
        alert, new_state, new_last_alert_at = _alert_sm.process_recovery(
            sensor_id=sensor.id,
            current_state=db_state.current_state,
            last_alert_at=db_state.last_alert_at,
        )
        if alert:
            db_alert = Alert(
                sensor_id=alert.sensor_id,
                severity=alert.severity,
                previous_state=alert.previous_state,
                message=alert.message,
            )
            session.add(db_alert)

            db_state.current_state = new_state
            db_state.last_alert_at = new_last_alert_at

            await _send_alert_notifications(session, db_alert, alert)


async def _send_alert_notifications(session: AsyncSession, db_alert: Alert, alert: AlertCreate):
    recipients_result = await session.execute(
        select(NotificationRecipient).where(NotificationRecipient.is_active.is_(True))
    )
    recipients = recipients_result.scalars().all()

    pydantic_recipients = [
        RecipientBase(**RecipientResponse.model_validate(r).model_dump(exclude={"id"}))
        for r in recipients
    ]

    pydantic_alert = AlertCreate(
        sensor_id=db_alert.sensor_id,
        severity=db_alert.severity,
        previous_state=db_alert.previous_state,
        message=db_alert.message,
    )

    # No BackgroundTasks available in MQTT context — fire-and-forget via asyncio
    asyncio.create_task(_notifier.send_notifications(pydantic_alert, pydantic_recipients))

    await ws_manager.publish_update(
        "alert",
        {
            "severity": alert.severity,
            "message": alert.message,
            "sensor_id": db_alert.sensor_id,
        },
    )
