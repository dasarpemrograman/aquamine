import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import (
    FastAPI,
    Header,
    UploadFile,
    File,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from pydantic import ValidationError
import io
import logging
import os
import re
import time
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete, or_, func

# Import CV modules
from .schemas.cv import BoundingBox, ImageAnalysisResponse
from .cv.detector import YellowBoyDetector, ImageDecodeError
from .utils.responses import error_response
from .chatbot.orchestrator import ChatOrchestrator

# Import IoT/ML modules
from .db.connection import get_db
from .db.models import (
    Sensor,
    Reading,
    Prediction,
    Alert,
    Anomaly,
    NotificationRecipient,
    SensorAlertState,
    UserSettings,
)
from .schemas.sensor import SensorResponse, ReadingResponse, SensorDataIngest
from .schemas.forecast import PredictionResponse
from .schemas.alert import (
    AlertResponse,
    AlertCreate,
    AnomalyResponse,
    RecipientBase,
    RecipientCreate,
    RecipientResponse,
)
from .schemas.settings import UserSettingsResponse, UserSettingsUpdate
from .schemas.help import FaqItem, FaqResponse
from .schemas.base import BaseSchema
from .iot.mqtt_bridge import process_mqtt_message
from .forecasting.timegpt_client import TimeGPTClient
from .anomaly.detector import AnomalyDetector, ANOMALY_THRESHOLDS
from .alerts.state_machine import AlertStateMachine
from .alerts.notifications import NotificationService
from .realtime.websocket import manager as ws_manager

logger = logging.getLogger(__name__)

REFRESH_INTERVAL_MIN_SECONDS = 5
REFRESH_INTERVAL_MAX_SECONDS = 60
QUIET_HOURS_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def verify_user_id(user_id: str, x_user_id: Optional[str] = Header(None, alias="X-User-Id")) -> str:
    """Verify the path user_id matches the authenticated user from the X-User-Id header.

    The frontend must send the authenticated user's ID in the X-User-Id header.
    This prevents users from accessing other users' settings by manipulating the URL.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail="Missing X-User-Id header - authentication required",
        )
    if x_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied - cannot access another user's settings",
        )
    return user_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(ws_manager.start_redis_listener())
    app.state.redis_listener_task = task

    def task_done_callback(t):
        if t.exception():
            logger.error(f"Redis listener task crashed: {t.exception()}")

    task.add_done_callback(task_done_callback)

    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="AquaMine AI API", lifespan=lifespan)

# Setup services
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cv_detector = YellowBoyDetector()
timegpt = TimeGPTClient()
anomaly_detector = AnomalyDetector(timegpt_client=timegpt)
alert_sm = AlertStateMachine()
notifier = NotificationService()
chat_orchestrator = ChatOrchestrator()

# --- Helpers ---


def calculate_severity(confidence: float) -> Literal["none", "mild", "moderate", "severe"]:
    """Calculate severity based on detection confidence.

    Thresholds:
    - < 0.5 (50%): none (false positive likely)
    - 0.5-0.65:    mild
    - 0.65-0.8:    moderate
    - >= 0.8:      severe
    """
    if confidence < 0.5:
        return "none"
    elif confidence < 0.65:
        return "mild"
    elif confidence < 0.8:
        return "moderate"
    else:
        return "severe"


def _calculate_forecast_confidence(
    value: float, lower: Optional[float], upper: Optional[float], data_quality: float = 1.0
) -> float:
    if lower is None or upper is None:
        base_confidence = 0.7
    else:
        span = abs(upper - lower)
        base = max(abs(value), 1.0)
        base_confidence = 1 - min(span / base, 1.0)
    data_quality = max(min(data_quality, 1.0), 0.0)
    confidence = base_confidence * (0.5 + 0.5 * data_quality)
    return round(max(confidence, 0.0), 2)


def _format_forecast_points(
    forecast_values: list[dict[str, object]], data_quality: float = 1.0
) -> list[dict[str, object]]:
    points = []
    for point in forecast_values or []:
        if isinstance(point, dict):
            timestamp = point.get("timestamp")
            value = point.get("value")
            lower = point.get("lower")
            upper = point.get("upper")
        else:
            timestamp = getattr(point, "timestamp", None)
            value = getattr(point, "value", None)
            lower = getattr(point, "lower", None)
            upper = getattr(point, "upper", None)

        if value is None:
            continue

        if not isinstance(value, (int, float)):
            continue

        lower_val = float(lower) if isinstance(lower, (int, float)) else None
        upper_val = float(upper) if isinstance(upper, (int, float)) else None
        value_val = float(value)

        points.append(
            {
                "timestamp": timestamp,
                "ph_pred": value_val,
                "confidence": _calculate_forecast_confidence(
                    value_val, lower_val, upper_val, data_quality=data_quality
                ),
            }
        )

    return points


def _format_anomaly_label(parameter: Optional[str]) -> str:
    if not parameter:
        return "Sensor"
    if parameter.lower() == "ph":
        return "pH"
    return parameter.capitalize()


def _format_anomaly_summary(anomaly: Optional[Anomaly]) -> dict[str, object]:
    if not anomaly:
        return {"score": 0.0, "severity": "none", "reason": "No anomalies detected"}

    score = float(anomaly.anomaly_score or 0.0)
    detection_method = (anomaly.detection_method or "").lower()
    if "critical" in detection_method:
        severity = "critical"
    elif "warning" in detection_method:
        severity = "warning"
    elif score >= 8.0:
        severity = "critical"
    elif score >= 3.0:
        severity = "warning"
    else:
        severity = "none"

    label = _format_anomaly_label(anomaly.parameter)
    if detection_method:
        reason = f"{label} {detection_method.replace('_', ' ')}"
    else:
        reason = f"{label} anomaly detected"

    return {"score": score, "severity": severity, "reason": reason}


def _validate_quiet_hours(value: Optional[str], label: str) -> None:
    if value is None:
        return
    if not QUIET_HOURS_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"{label} must be in HH:MM 24-hour format")


def _validate_timezone(value: Optional[str]) -> None:
    if value is None:
        return
    if not value.strip():
        raise HTTPException(status_code=400, detail="timezone must be a non-empty string")


def _ensure_settings_timestamps(settings: UserSettings) -> None:
    if settings.created_at is None:
        settings.created_at = datetime.now(timezone.utc)
    if settings.updated_at is None:
        settings.updated_at = datetime.now(timezone.utc)


async def _get_or_create_settings(
    db: AsyncSession, user_id: str, timezone_value: str = "UTC"
) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id, timezone=timezone_value)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    _ensure_settings_timestamps(settings)
    return settings


async def _get_latest_reading(db: AsyncSession, sensor_id: int) -> Optional[Reading]:
    query = (
        select(Reading)
        .where(Reading.sensor_id == sensor_id)
        .order_by(desc(Reading.timestamp))
        .limit(1)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


def _format_current_sensor_state(latest: Optional[Reading]) -> dict[str, object]:
    if not latest:
        return {
            "score": 0.0,
            "severity": "unknown",
            "reason": "No data",
            "last_updated": None,
        }

    candidates: list[tuple[float, str, str]] = []
    label = _format_anomaly_label("ph")
    if latest.ph is not None:
        if latest.ph < ANOMALY_THRESHOLDS["ph"]["critical_low"]:
            candidates.append((10.0, "critical", f"{label} critical: {latest.ph:.2f}"))
        elif latest.ph < ANOMALY_THRESHOLDS["ph"]["warning_low"]:
            candidates.append((5.0, "warning", f"{label} warning: {latest.ph:.2f}"))
        if latest.ph > ANOMALY_THRESHOLDS["ph"]["critical_high"]:
            candidates.append((10.0, "critical", f"{label} critical: {latest.ph:.2f}"))
        elif latest.ph > ANOMALY_THRESHOLDS["ph"]["warning_high"]:
            candidates.append((5.0, "warning", f"{label} warning: {latest.ph:.2f}"))

    label = _format_anomaly_label("turbidity")
    if latest.turbidity is not None:
        if latest.turbidity > ANOMALY_THRESHOLDS["turbidity"]["critical_high"]:
            candidates.append((10.0, "critical", f"{label} critical: {latest.turbidity:.1f}"))
        elif latest.turbidity > ANOMALY_THRESHOLDS["turbidity"]["warning_high"]:
            candidates.append((5.0, "warning", f"{label} warning: {latest.turbidity:.1f}"))

    label = _format_anomaly_label("temperature")
    if latest.temperature is not None:
        if latest.temperature > ANOMALY_THRESHOLDS["temperature"]["critical_high"]:
            candidates.append((10.0, "critical", f"{label} critical: {latest.temperature:.1f}"))
        elif latest.temperature > ANOMALY_THRESHOLDS["temperature"]["warning_high"]:
            candidates.append((5.0, "warning", f"{label} warning: {latest.temperature:.1f}"))

    if not candidates:
        return {
            "score": 0.0,
            "severity": "normal",
            "reason": "All parameters normal",
            "last_updated": latest.timestamp,
        }

    score, severity, reason = max(candidates, key=lambda item: item[0])
    return {
        "score": score,
        "severity": severity,
        "reason": reason,
        "last_updated": latest.timestamp,
    }


async def _get_latest_anomaly(
    db: AsyncSession, sensor_id: Optional[int] = None
) -> Optional[Anomaly]:
    query = select(Anomaly).order_by(desc(Anomaly.timestamp)).limit(1)
    if sensor_id is not None:
        query = query.where(Anomaly.sensor_id == sensor_id)

    result = await db.execute(query)
    return result.scalar_one_or_none()


# --- Endpoints ---


class ChatRequest(BaseSchema):
    message: str
    session_id: str


class ForecastCompatibilityRequest(BaseSchema):
    sensor_id: int


class TimelineForecastPoint(BaseSchema):
    timestamp: datetime
    ph_pred: float
    confidence: float


class TimelineAnomalySummary(BaseSchema):
    score: float
    severity: str
    reason: str
    last_updated: Optional[datetime] = None


class LatestReadingSnapshot(BaseSchema):
    timestamp: datetime
    ph: Optional[float] = None
    turbidity: Optional[float] = None
    temperature: Optional[float] = None


class TimelineForecastResponse(BaseSchema):
    forecast: List[TimelineForecastPoint]
    anomaly: TimelineAnomalySummary
    latest_reading: Optional[LatestReadingSnapshot] = None
    history_hours: Optional[int] = None
    warning: Optional[str] = None


FAQ_ITEMS: List[FaqItem] = [
    FaqItem(
        title="What is AquaMine AI?",
        body=(
            "AquaMine AI is an early warning system for Acid Mine Drainage (AMD). "
            "It combines IoT telemetry, anomaly detection, forecasting, computer vision, "
            "and a realtime dashboard to monitor water quality."
        ),
    ),
    FaqItem(
        title="How do alerts work?",
        body=(
            "Sensor readings are checked against thresholds and anomaly rules. "
            "When a warning or critical condition is detected, the alert state machine "
            "creates an alert and can notify active recipients. Recovery clears the alert."
        ),
    ),
    FaqItem(
        title="Which sensors and readings are expected?",
        body=(
            "The system expects a sensor_id, timestamp, and readings such as pH, turbidity, "
            "and temperature. Missing values are allowed, but richer data improves detection "
            "and forecasting confidence."
        ),
    ),
    FaqItem(
        title="How is forecasting generated?",
        body=(
            "Forecasts are generated with TimeGPT as the primary model and XGBoost as a "
            "fallback. The API needs recent sensor data (ideally 24 hours) to return "
            "forecast points with confidence scores."
        ),
    ),
    FaqItem(
        title="How do I use the dashboard locally?",
        body=(
            "Copy .env from .env.example, run docker compose up -d, and open "
            "http://localhost:3000. Verify the API at http://localhost:8000/health."
        ),
    ),
    FaqItem(
        title="Why does the dashboard show 'failed to fetch'?",
        body=(
            "Check that NEXT_PUBLIC_API_BASE_URL and related variables point to your VPS "
            "IP or domain, not localhost. Rebuild the dashboard container so the values are "
            "baked into the frontend bundle."
        ),
    ),
    FaqItem(
        title="Why is the WebSocket not connecting?",
        body=(
            "Confirm NEXT_PUBLIC_WS_BASE_URL uses ws:// for HTTP or wss:// for HTTPS and that "
            "Nginx proxies /ws/ to the API. Mixed content errors are a common cause."
        ),
    ),
]


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/help/faq", response_model=FaqResponse)
def get_faq() -> FaqResponse:
    return FaqResponse(items=FAQ_ITEMS)


@app.post("/api/v1/chat")
async def chat(request: ChatRequest) -> dict[str, str]:
    response = await chat_orchestrator.process_user_message(request.message, request.session_id)
    return {"response": response}


# --- CV Endpoints ---


@app.post("/api/v1/cv/analyze")
async def analyze_image(file: UploadFile | None = File(None)):
    if file is None:
        return error_response(
            422, "MISSING_FILE", "No file uploaded. Use 'file' field in multipart form."
        )

    content = await file.read()

    if len(content) > 5 * 1024 * 1024:
        size_mb = len(content) / (1024 * 1024)
        return error_response(
            413, "FILE_TOO_LARGE", f"File exceeds 5MB limit. Received: {size_mb:.1f}MB"
        )

    if file.content_type not in ["image/jpeg", "image/png"]:
        return error_response(
            400, "INVALID_FILE_TYPE", f"Only JPG and PNG supported. Received: {file.content_type}"
        )

    try:
        img = Image.open(io.BytesIO(content))
        img_width, img_height = img.size
    except Exception:
        return error_response(
            422, "IMAGE_DECODE_FAILED", "Could not decode image. File may be corrupted."
        )

    start_time = time.perf_counter()
    try:
        detections, warnings = cv_detector.detect(content, img=img)
    except ImageDecodeError as e:
        return error_response(422, "IMAGE_DECODE_FAILED", str(e))
    except Exception as e:
        return error_response(500, "INFERENCE_FAILED", f"Model inference failed: {str(e)}")
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    # Detection confidence threshold for yellow boy
    DETECTION_THRESHOLD = 0.65

    # Filter detections by threshold
    valid_detections = [d for d in detections if d.confidence >= DETECTION_THRESHOLD]

    bboxes = [
        BoundingBox(x=d.x, y=d.y, width=d.width, height=d.height, confidence=d.confidence)
        for d in valid_detections
    ]
    highest = max(bboxes, key=lambda b: b.confidence) if bboxes else None
    max_conf = highest.confidence if highest else 0.0

    # Detected = True if we have at least one detection above threshold
    detected = len(bboxes) > 0

    return ImageAnalysisResponse(
        detected=detected,
        confidence=max_conf,
        severity=calculate_severity(max_conf),
        bbox=highest,
        bboxes=bboxes,
        latency_ms=elapsed_ms,
        warnings=warnings,
        model_version=cv_detector.version,
        image_width=img_width,
        image_height=img_height,
    )


# --- IoT / ML Endpoints ---


@app.get("/api/v1/sensors", response_model=List[SensorResponse])
async def list_sensors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sensor).order_by(Sensor.id))
    return result.scalars().all()


@app.get("/api/v1/sensors/{sensor_id}/readings", response_model=List[ReadingResponse])
async def get_sensor_readings(sensor_id: int, hours: int = 24, db: AsyncSession = Depends(get_db)):
    start_time = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = (
        select(Reading)
        .where(Reading.sensor_id == sensor_id, Reading.timestamp >= start_time)
        .order_by(desc(Reading.timestamp))
    )

    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/v1/sensors/ingest")
async def ingest_sensor_data(
    payload: SensorDataIngest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    try:
        await process_mqtt_message(payload)

        result = await db.execute(select(Sensor).where(Sensor.sensor_id == payload.sensor_id))
        sensor = result.scalar_one_or_none()
        if not sensor:
            raise HTTPException(status_code=404, detail="Sensor not found after ingestion")

        # --- Alert State Management (Persistence) ---
        # 1. Fetch current state from DB
        stmt = select(SensorAlertState).where(SensorAlertState.sensor_id == sensor.id)
        result = await db.execute(stmt)
        db_state = result.scalar_one_or_none()

        if not db_state:
            db_state = SensorAlertState(sensor_id=sensor.id, current_state="normal")
            db.add(db_state)
            await db.commit()
            await db.refresh(db_state)

        anomalies = anomaly_detector.detect_threshold_anomalies(
            sensor.id,
            {key: value for key, value in payload.readings.items() if value is not None},
            payload.timestamp,
        )

        alert_triggered = None  # Track if any alert happened to update DB

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
                db.add(db_anomaly)

                severity = "critical" if "critical" in (anom.detection_method or "") else "warning"
                message = f"{anom.parameter.upper()} {severity}: {anom.value:.2f}"

                alert = await alert_sm.process_anomaly(sensor.id, severity, message)
                if alert:
                    alert_triggered = alert  # Keep track
                    db_alert = Alert(
                        sensor_id=alert.sensor_id,
                        severity=alert.severity,
                        previous_state=alert.previous_state,
                        message=alert.message,
                    )
                    db.add(db_alert)
                    await db.commit()
                    await db.refresh(db_alert)

                    # Fetch recipients
                    recipients_result = await db.execute(
                        select(NotificationRecipient).where(NotificationRecipient.is_active == True)
                    )
                    recipients = recipients_result.scalars().all()

                    # Convert DB recipients to Pydantic
                    pydantic_recipients = [
                        RecipientBase(
                            **RecipientResponse.model_validate(r).model_dump(exclude={"id"})
                        )
                        for r in recipients
                    ]

                    # Convert DB alert to Pydantic
                    pydantic_alert = AlertCreate(
                        sensor_id=db_alert.sensor_id,
                        severity=db_alert.severity,
                        previous_state=db_alert.previous_state,
                        message=db_alert.message,
                    )

                    background_tasks.add_task(
                        notifier.send_notifications, pydantic_alert, pydantic_recipients
                    )

                    await ws_manager.publish_update(
                        "alert",
                        {
                            "severity": alert.severity,
                            "message": alert.message,
                            "sensor_id": sensor.id,
                        },
                    )
        else:
            # Check for recovery
            alert = await alert_sm.process_recovery(sensor.id)
            if alert:
                alert_triggered = alert  # Keep track
                db_alert = Alert(
                    sensor_id=alert.sensor_id,
                    severity=alert.severity,
                    previous_state=alert.previous_state,
                    message=alert.message,
                )
                db.add(db_alert)
                await db.commit()
                await db.refresh(db_alert)

                # Fetch recipients
                recipients_result = await db.execute(
                    select(NotificationRecipient).where(NotificationRecipient.is_active == True)
                )
                recipients = recipients_result.scalars().all()

                # Convert DB recipients to Pydantic
                pydantic_recipients = [
                    RecipientBase(**RecipientResponse.model_validate(r).model_dump(exclude={"id"}))
                    for r in recipients
                ]

                # Convert DB alert to Pydantic
                pydantic_alert = AlertCreate(
                    sensor_id=db_alert.sensor_id,
                    severity=db_alert.severity,
                    previous_state=db_alert.previous_state,
                    message=db_alert.message,
                )

                background_tasks.add_task(
                    notifier.send_notifications, pydantic_alert, pydantic_recipients
                )

                await ws_manager.publish_update(
                    "alert",
                    {"severity": alert.severity, "message": alert.message, "sensor_id": sensor.id},
                )

        # 3. Update Alert State in DB if changed
        if alert_triggered:
            # If severity is 'info' (recovery), new state is normal
            new_state = "normal" if alert_triggered.severity == "info" else alert_triggered.severity
            db_state.current_state = new_state
            # We use DB timestamp for consistency, but alert_triggered doesn't have it (it's Pydantic)
            # Use current time or db_alert.created_at if available.
            # db_alert is local in loop, not available here easily. Use datetime.now()
            db_state.last_alert_at = datetime.now(timezone.utc)
            db.add(db_state)
            await db.commit()

        await db.commit()

        await ws_manager.publish_update("sensor_reading", payload.model_dump(mode="json"))

        return {"status": "ingested", "anomalies_detected": len(anomalies)}
    except ValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")
    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        await db.rollback()
        logger.exception(f"Unexpected error during ingestion: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/v1/forecast/{sensor_id}", response_model=List[PredictionResponse])
async def get_forecast(sensor_id: int, db: AsyncSession = Depends(get_db)):
    # Get latest forecast
    query = (
        select(Prediction)
        .where(Prediction.sensor_id == sensor_id)
        .order_by(desc(Prediction.created_at))
        .limit(3)
    )  # One for each param

    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/v1/forecast", response_model=TimelineForecastResponse)
async def get_forecast_compatibility(
    payload: ForecastCompatibilityRequest, db: AsyncSession = Depends(get_db)
):
    latest_reading = await _get_latest_reading(db, payload.sensor_id)
    anomaly_summary = _format_current_sensor_state(latest_reading)

    history_hours = None
    if latest_reading:
        history_window_start = datetime.now(timezone.utc) - timedelta(hours=168)
        earliest_result = await db.execute(
            select(Reading.timestamp)
            .where(
                Reading.sensor_id == payload.sensor_id,
                Reading.timestamp >= history_window_start,
            )
            .order_by(Reading.timestamp)
            .limit(1)
        )
        earliest = earliest_result.scalar_one_or_none()
        if earliest:
            history_hours = max(
                int((latest_reading.timestamp - earliest).total_seconds() / 3600), 1
            )

    data_window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    count_result = await db.execute(
        select(func.count())
        .select_from(Reading)
        .where(
            Reading.sensor_id == payload.sensor_id,
            Reading.timestamp >= data_window_start,
            Reading.ph.is_not(None),
        )
    )
    recent_ph_count = int(count_result.scalar_one() or 0)
    if recent_ph_count < 12:
        warning = "Insufficient data for pH forecast (need 24h of data)"
        latest_snapshot = (
            LatestReadingSnapshot(
                timestamp=latest_reading.timestamp,
                ph=latest_reading.ph,
                turbidity=latest_reading.turbidity,
                temperature=latest_reading.temperature,
            )
            if latest_reading
            else None
        )
        return {
            "forecast": [],
            "anomaly": anomaly_summary,
            "latest_reading": latest_snapshot,
            "history_hours": history_hours,
            "warning": warning,
        }

    prediction_query = (
        select(Prediction)
        .where(Prediction.sensor_id == payload.sensor_id, Prediction.parameter == "ph")
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    result = await db.execute(prediction_query)
    prediction = result.scalar_one_or_none()
    data_quality = min(recent_ph_count / 24.0, 1.0)
    forecast = _format_forecast_points(
        prediction.forecast_values if prediction else [], data_quality=data_quality
    )

    latest_snapshot = (
        LatestReadingSnapshot(
            timestamp=latest_reading.timestamp,
            ph=latest_reading.ph,
            turbidity=latest_reading.turbidity,
            temperature=latest_reading.temperature,
        )
        if latest_reading
        else None
    )

    return {
        "forecast": forecast,
        "anomaly": anomaly_summary,
        "latest_reading": latest_snapshot,
        "history_hours": history_hours,
        "warning": None,
    }


@app.post("/api/v1/forecast/generate")
async def generate_forecast_endpoint(
    sensor_id: int, _background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    """Generate forecast for a sensor."""
    # 1. Fetch historical data (7 days)
    start_time = datetime.now(timezone.utc) - timedelta(days=7)
    query = (
        select(Reading)
        .where(Reading.sensor_id == sensor_id, Reading.timestamp >= start_time)
        .order_by(Reading.timestamp)
    )
    result = await db.execute(query)
    readings = result.scalars().all()

    if not readings:
        return {"status": "error", "message": "No data found for forecasting"}

    # 2. Prepare data for TimeGPT
    # We need a DataFrame with unique_id, ds, y
    data = []
    sensor_str = f"sensor_{sensor_id}"
    for r in readings:
        # Flatten parameters
        if r.ph is not None:
            data.append({"unique_id": f"{sensor_str}_ph", "ds": r.timestamp, "y": r.ph})
        if r.turbidity is not None:
            data.append(
                {"unique_id": f"{sensor_str}_turbidity", "ds": r.timestamp, "y": r.turbidity}
            )
        if r.temperature is not None:
            data.append(
                {"unique_id": f"{sensor_str}_temperature", "ds": r.timestamp, "y": r.temperature}
            )

    import pandas as pd

    df = pd.DataFrame(data)

    # 3. Generate Forecast (Async)
    # We run this in background or await if fast enough. Mock is fast.
    # For now, let's await it to return immediate status.
    forecasts = timegpt.generate_forecast(df, horizon=168)  # 7 days

    # 4. Store Predictions
    count = 0
    for uid, points in forecasts.items():
        # uid: sensor_1_ph -> parameter: ph
        parameter = uid.split("_")[-1]

        # Serialize values
        forecast_values = [p.model_dump(mode="json") for p in points]

        prediction = Prediction(
            sensor_id=sensor_id,
            forecast_start=points[0].timestamp,
            forecast_end=points[-1].timestamp,
            parameter=parameter,
            forecast_values=forecast_values,
            model_version="timegpt-1",
        )
        db.add(prediction)
        count += 1

    await db.commit()

    return {"status": "success", "predictions_generated": count}


@app.get("/api/v1/anomaly", response_model=TimelineAnomalySummary)
async def get_anomaly_summary(sensor_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    anomaly = await _get_latest_anomaly(db, sensor_id)
    return _format_anomaly_summary(anomaly)


@app.get("/api/v1/anomalies", response_model=List[AnomalyResponse])
async def list_anomalies(
    sensor_id: Optional[int] = None,
    parameter: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    query = select(Anomaly).order_by(desc(Anomaly.timestamp)).limit(limit)
    if sensor_id:
        query = query.where(Anomaly.sensor_id == sensor_id)
    if parameter:
        query = query.where(Anomaly.parameter == parameter)

    result = await db.execute(query)
    return result.scalars().all()


@app.get("/api/v1/alerts", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None, limit: int = 50, db: AsyncSession = Depends(get_db)
):
    query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if severity:
        query = query.where(Alert.severity == severity)

    result = await db.execute(query)
    return result.scalars().all()


@app.get("/api/v1/settings/{user_id}", response_model=UserSettingsResponse)
async def get_user_settings(
    user_id: str = Depends(verify_user_id), db: AsyncSession = Depends(get_db)
):
    settings = await _get_or_create_settings(db, user_id, timezone_value="UTC")
    _ensure_settings_timestamps(settings)
    return UserSettingsResponse.model_validate(settings)


@app.patch("/api/v1/settings/{user_id}", response_model=UserSettingsResponse)
async def update_user_settings(
    updates: UserSettingsUpdate,
    user_id: str = Depends(verify_user_id),
    db: AsyncSession = Depends(get_db),
):
    update_data = updates.model_dump(exclude_unset=True)

    if "refresh_interval_seconds" in update_data:
        refresh_interval = update_data["refresh_interval_seconds"]
        if refresh_interval is None:
            raise HTTPException(
                status_code=400,
                detail="refresh_interval_seconds cannot be null",
            )
        if not (REFRESH_INTERVAL_MIN_SECONDS <= refresh_interval <= REFRESH_INTERVAL_MAX_SECONDS):
            raise HTTPException(
                status_code=400,
                detail=(
                    "refresh_interval_seconds must be between "
                    f"{REFRESH_INTERVAL_MIN_SECONDS} and {REFRESH_INTERVAL_MAX_SECONDS} seconds"
                ),
            )

    if "timezone" in update_data:
        if update_data["timezone"] is None:
            raise HTTPException(status_code=400, detail="timezone must be a non-empty string")
        _validate_timezone(update_data["timezone"])

    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = result.scalar_one_or_none()
    is_new = settings is None
    if is_new:
        settings = UserSettings(
            user_id=user_id,
            timezone=update_data.get("timezone") or "UTC",
        )

    existing_quiet_start = None if is_new else settings.quiet_hours_start
    existing_quiet_end = None if is_new else settings.quiet_hours_end
    quiet_start = update_data.get("quiet_hours_start", existing_quiet_start)
    quiet_end = update_data.get("quiet_hours_end", existing_quiet_end)
    _validate_quiet_hours(quiet_start, "quiet_hours_start")
    _validate_quiet_hours(quiet_end, "quiet_hours_end")

    for key, value in update_data.items():
        setattr(settings, key, value)

    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    _ensure_settings_timestamps(settings)
    return UserSettingsResponse.model_validate(settings)


@app.post("/api/v1/recipients", response_model=RecipientResponse)
async def create_recipient(recipient: RecipientCreate, db: AsyncSession = Depends(get_db)):
    db_recipient = NotificationRecipient(**recipient.model_dump())
    db.add(db_recipient)
    await db.commit()
    await db.refresh(db_recipient)
    return RecipientResponse.model_validate(db_recipient)


@app.get("/api/v1/recipients", response_model=List[RecipientResponse])
async def list_recipients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NotificationRecipient).order_by(NotificationRecipient.id))
    recipients = result.scalars().all()
    return [RecipientResponse.model_validate(r) for r in recipients]


@app.patch("/api/v1/recipients/{recipient_id}", response_model=RecipientResponse)
async def update_recipient(
    recipient_id: int, updates: RecipientBase, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationRecipient).where(NotificationRecipient.id == recipient_id)
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(recipient, key, value)

    db.add(recipient)
    await db.commit()
    await db.refresh(recipient)
    return RecipientResponse.model_validate(recipient)


@app.delete("/api/v1/recipients/{recipient_id}")
async def delete_recipient(recipient_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NotificationRecipient).where(NotificationRecipient.id == recipient_id)
    )
    recipient = result.scalar_one_or_none()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    await db.delete(recipient)
    await db.commit()
    return {"status": "deleted"}


@app.delete("/api/v1/test-data")
async def clear_test_data(db: AsyncSession = Depends(get_db)):
    anomalies_stmt = delete(Anomaly).where(
        Anomaly.detection_method == "threshold_critical", Anomaly.value.in_([1.5, 2.0])
    )
    alerts_stmt = delete(Alert).where(
        or_(
            Alert.message.ilike("%PH critical: 1.50%"),
            Alert.message.ilike("%PH critical: 2.00%"),
        )
    )

    anomalies_result = await db.execute(anomalies_stmt)
    alerts_result = await db.execute(alerts_stmt)
    await db.commit()

    return {
        "anomalies_deleted": int(getattr(anomalies_result, "rowcount", 0) or 0),
        "alerts_deleted": int(getattr(alerts_result, "rowcount", 0) or 0),
    }


@app.post("/api/v1/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int, username: str = "admin", db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = username
    await db.commit()
    return {"status": "acknowledged"}


# --- WebSocket ---


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from client, but we need to keep loop open
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
