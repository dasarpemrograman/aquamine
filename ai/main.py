import asyncio
from typing import Literal, List, Optional
from datetime import datetime, timedelta

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import time
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

# Import CV modules
from ai.schemas.cv import BoundingBox, ImageAnalysisResponse
from ai.cv.detector import YellowBoyDetector, ImageDecodeError
from ai.utils.responses import error_response

# Import IoT/ML modules
from ai.db.connection import get_db
from ai.db.models import Sensor, Reading, Prediction, Alert, Anomaly
from ai.schemas.sensor import SensorResponse, ReadingResponse, SensorDataIngest
from ai.schemas.forecast import PredictionResponse
from ai.schemas.alert import AlertResponse, AlertCreate
from ai.iot.mqtt_bridge import process_mqtt_message
from ai.forecasting.timegpt_client import TimeGPTClient
from ai.anomaly.detector import AnomalyDetector
from ai.alerts.state_machine import AlertStateMachine
from ai.alerts.notifications import NotificationService
from ai.realtime.websocket import manager as ws_manager

app = FastAPI(title="AquaMine AI API")

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

# --- Helpers ---


def calculate_severity(confidence: float) -> Literal["none", "mild", "moderate", "severe"]:
    if confidence < 0.3:
        return "none"
    elif confidence < 0.5:
        return "mild"
    elif confidence < 0.7:
        return "moderate"
    else:
        return "severe"


# --- Endpoints ---


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# --- CV Endpoints ---


@app.post("/api/v1/cv/analyze")
async def analyze_image(file: UploadFile | None = File(None)):
    if file is None:
        return error_response(
            422, "MISSING_FILE", "No file uploaded. Use 'file' field in multipart form."
        )

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        size_mb = len(content) / (1024 * 1024)
        return error_response(
            413, "FILE_TOO_LARGE", f"File exceeds 10MB limit. Received: {size_mb:.1f}MB"
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

    bboxes = [
        BoundingBox(x=d.x, y=d.y, width=d.width, height=d.height, confidence=d.confidence)
        for d in detections
    ]
    highest = max(bboxes, key=lambda b: b.confidence) if bboxes else None
    max_conf = highest.confidence if highest else 0.0

    return ImageAnalysisResponse(
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
    start_time = datetime.now() - timedelta(hours=hours)
    query = (
        select(Reading)
        .where(Reading.sensor_id == sensor_id, Reading.timestamp >= start_time)
        .order_by(desc(Reading.timestamp))
    )

    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/v1/sensors/ingest")
async def ingest_sensor_data(payload: SensorDataIngest, background_tasks: BackgroundTasks):
    try:
        # Process storage async (in production, use Queue)
        await process_mqtt_message(payload)

        # Real-time components
        # 1. Anomaly Detection
        # 2. Alert Logic
        # 3. WebSocket Broadcast

        # We need the numeric ID, so we might need to fetch it again or cache it
        # For simplicity in this endpoint, we'll just broadcast the raw payload for now
        await ws_manager.publish_update("sensor_reading", payload.model_dump(mode="json"))

        return {"status": "ingested"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.post("/api/v1/forecast/generate")
async def generate_forecast_endpoint(sensor_id: int, background_tasks: BackgroundTasks):
    # TODO: Implement full forecast generation logic (fetch history -> TimeGPT -> Store)
    # This is a placeholder as the core logic is in the TimeGPT client
    return {"status": "generation_scheduled"}


@app.get("/api/v1/alerts", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None, limit: int = 50, db: AsyncSession = Depends(get_db)
):
    query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if severity:
        query = query.where(Alert.severity == severity)

    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/v1/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int, username: str = "admin", db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged_at = datetime.now()
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


# Startup event to launch Redis listener
@app.on_event("startup")
async def startup_event():
    # Start Redis listener in background
    asyncio.create_task(ws_manager.start_redis_listener())
