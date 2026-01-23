from datetime import datetime, timezone
from typing import Literal

import pandas as pd
from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import io
import os
import time
from PIL import Image

from db.connection import get_session
from db.models import Sensor, Reading, Prediction, Anomaly, Alert, SensorAlertState
from forecasting.timegpt_client import generate_all_forecasts, store_forecast
from iot.mqtt_bridge import process_mqtt_message
from alerts.state_machine import AlertStateMachine, acknowledge_alert, aggregate_sensor_states
from realtime.websocket import manager as ws_manager, redis_listener

from schemas import (
    BoundingBox,
    ImageAnalysisResponse,
    SensorResponse,
    ReadingResponse,
    MQTTPayload,
    ForecastResponse,
    AlertResponse,
    AlertAcknowledge,
    AlertSummary,
)
from cv.detector import YellowBoyDetector, ImageDecodeError
from utils.responses import error_response

app = FastAPI(title="AquaMine AI API")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = YellowBoyDetector()


@app.on_event("startup")
async def startup_event():
    import asyncio

    asyncio.create_task(redis_listener(ws_manager))


def calculate_severity(confidence: float) -> Literal["none", "mild", "moderate", "severe"]:
    if confidence < 0.3:
        return "none"
    elif confidence < 0.5:
        return "mild"
    elif confidence < 0.7:
        return "moderate"
    else:
        return "severe"


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# --- Sensor Endpoints ---


@app.get("/api/v1/sensors", response_model=list[SensorResponse])
def get_sensors(db: Session = Depends(get_session)):
    sensors = db.query(Sensor).filter(Sensor.is_active == True).all()
    return sensors


@app.get("/api/v1/sensors/{sensor_id}/readings", response_model=list[ReadingResponse])
def get_sensor_readings(
    sensor_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 100,
    db: Session = Depends(get_session),
):
    query = db.query(Reading).filter(Reading.sensor_id == sensor_id)

    if start:
        query = query.filter(Reading.timestamp >= start)
    if end:
        query = query.filter(Reading.timestamp <= end)

    readings = query.order_by(Reading.timestamp.desc()).limit(limit).all()
    return readings


@app.post("/api/v1/sensors/ingest")
def ingest_sensor_data(payload: MQTTPayload, db: Session = Depends(get_session)):
    import json

    result = process_mqtt_message(db, json.dumps(payload.dict(), default=str))

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# --- Forecast Endpoints ---


@app.get("/api/v1/forecast/{sensor_id}", response_model=ForecastResponse)
def get_forecast(
    sensor_id: int,
    parameter: str = Query(..., pattern="^(ph|turbidity|temperature)$"),
    db: Session = Depends(get_session),
):
    forecast = (
        db.query(Prediction)
        .filter(Prediction.sensor_id == sensor_id, Prediction.parameter == parameter)
        .order_by(Prediction.created_at.desc())
        .first()
    )

    if not forecast:
        raise HTTPException(
            status_code=404, detail="No forecast found for this sensor and parameter"
        )

    return forecast


@app.post("/api/v1/forecast/generate")
def trigger_forecast_generation(payload: dict[str, int], db: Session = Depends(get_session)):
    sensor_id = payload.get("sensor_id")
    if not sensor_id:
        raise HTTPException(status_code=400, detail="sensor_id required")

    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    # Load recent readings into DataFrame
    query = f"""
        SELECT timestamp as ds, ph, turbidity, temperature 
        FROM readings 
        WHERE sensor_id = {sensor_id} 
        AND timestamp > NOW() - INTERVAL '14 days'
        ORDER BY timestamp ASC
    """
    df = pd.read_sql(query, db.bind)

    if df.empty:
        raise HTTPException(status_code=400, detail="Not enough data to generate forecast")

    # Format for TimeGPT
    records = []
    for _, row in df.iterrows():
        for param in ["ph", "turbidity", "temperature"]:
            records.append(
                {"unique_id": f"{sensor.sensor_id}_{param}", "ds": row["ds"], "y": row[param]}
            )
    timegpt_df = pd.DataFrame(records)

    # Generate forecast
    forecasts = generate_all_forecasts(timegpt_df)

    saved_forecasts = []
    for param, forecast_df in forecasts.items():
        if not forecast_df.empty:
            pred = store_forecast(db, sensor_id, param, forecast_df)
            saved_forecasts.append(pred.id)

    return {"success": True, "generated_count": len(saved_forecasts)}


# --- Alert Endpoints ---


@app.get("/api/v1/alerts", response_model=list[AlertResponse])
def get_alerts(
    severity: str | None = None,
    acknowledged: bool | None = None,
    limit: int = 50,
    db: Session = Depends(get_session),
):
    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity)

    if acknowledged is not None:
        if acknowledged:
            query = query.filter(Alert.acknowledged_at != None)
        else:
            query = query.filter(Alert.acknowledged_at == None)

    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
    return alerts


@app.post("/api/v1/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert_endpoint(
    alert_id: int, payload: AlertAcknowledge, db: Session = Depends(get_session)
):
    try:
        alert = acknowledge_alert(db, alert_id, payload.acknowledged_by)
        return alert
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v1/alerts/summary", response_model=AlertSummary)
def get_alert_summary(db: Session = Depends(get_session)):
    # Get latest state for each sensor
    states = db.query(SensorAlertState).all()
    state_dicts = [{"current_state": s.current_state} for s in states]

    result = aggregate_sensor_states(state_dicts)

    # Count unacknowledged
    unack_count = db.query(Alert).filter(Alert.acknowledged_at == None).count()
    result["unacknowledged_count"] = unack_count

    return result


# --- WebSocket ---


@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, maybe handle client messages if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# --- CV Endpoint (Existing) ---


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
        detections, warnings = detector.detect(content, img=img)
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
        model_version=detector.version,
        image_width=img_width,
        image_height=img_height,
    )
