from typing import Literal

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import io
import os
import time
import pandas as pd
from PIL import Image

from schemas.cv import BoundingBox, ImageAnalysisResponse
from schemas.forecast import ForecastRequest, ForecastResponse, ForecastPoint
from schemas.anomaly import AnomalyRequest, AnomalyResponse, AnomalyItem
from schemas.alerts import (
    AlertRequest,
    AlertResponse,
    AlertStatesResponse,
    StateChange,
    NotificationResult,
)
from cv.detector import YellowBoyDetector, ImageDecodeError
from utils.responses import error_response
from anomaly import AnomalyDetector
from alerts import AlertStateMachine
from notifications import NotificationService

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
anomaly_detector = AnomalyDetector(use_timegpt=True)
alert_state_machine = AlertStateMachine()
notification_service = NotificationService()


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


@app.post("/api/v1/forecast", response_model=ForecastResponse)
async def forecast_endpoint(request: ForecastRequest):
    if not request.data:
        raise HTTPException(status_code=400, detail="No data provided")

    df = pd.DataFrame([d.model_dump() for d in request.data])

    try:
        from forecasting import TimeGPTForecaster

        forecaster = TimeGPTForecaster()
        result_df = forecaster.forecast(df, horizon_days=request.horizon_days)

        forecasts = []
        for _, row in result_df.iterrows():
            unique_id = row.get("unique_id", "")
            parts = unique_id.rsplit("_", 1)
            if len(parts) == 2:
                sensor_id, parameter = parts
                forecasts.append(
                    ForecastPoint(
                        timestamp=row["ds"],
                        sensor_id=sensor_id,
                        parameter=parameter,
                        predicted=row.get("TimeGPT", row.get("y", 0)),
                        lower_bound=row.get("TimeGPT-lo-90", row.get("TimeGPT", 0) * 0.9),
                        upper_bound=row.get("TimeGPT-hi-90", row.get("TimeGPT", 0) * 1.1),
                    )
                )

        return ForecastResponse(
            forecasts=forecasts,
            horizon_days=request.horizon_days,
            data_points=len(forecasts),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"TimeGPT unavailable: {e}")


@app.post("/api/v1/anomaly", response_model=AnomalyResponse)
async def anomaly_endpoint(request: AnomalyRequest):
    if not request.data:
        return AnomalyResponse(anomalies=[], total_anomalies=0, method="threshold")

    df = pd.DataFrame([d.model_dump() for d in request.data])

    anomalies_raw = anomaly_detector.detect(df)
    method = "timegpt" if anomaly_detector._client else "threshold"

    anomalies = [
        AnomalyItem(
            timestamp=a["timestamp"],
            sensor_id=a["sensor_id"],
            parameter=a["parameter"],
            value=a["value"],
            severity=a["severity"],
            severity_score=a["severity_score"],
            reason=a["reason"],
        )
        for a in anomalies_raw
    ]

    return AnomalyResponse(
        anomalies=anomalies,
        total_anomalies=len(anomalies),
        method=method,
    )


@app.post("/api/v1/alerts", response_model=AlertResponse)
async def process_alerts(request: AlertRequest):
    if not request.anomalies:
        return AlertResponse(
            processed=0,
            notifications_sent=NotificationResult(whatsapp=False, email=False, errors=[]),
            state_changes=[],
        )

    anomaly_dicts = [a.model_dump() for a in request.anomalies]
    aggregated = alert_state_machine.aggregate_anomalies(anomaly_dicts)

    state_changes = []
    alerts_to_notify = []

    for sensor_id, agg in aggregated.items():
        should_notify, alert_info = alert_state_machine.process_aggregated(agg)
        if should_notify and alert_info:
            state_changes.append(
                StateChange(
                    sensor_id=sensor_id,
                    old_state=alert_info["old_state"],
                    new_state=alert_info["new_state"],
                )
            )
            if request.notify:
                alerts_to_notify.append(alert_info)

    whatsapp_ok = False
    email_ok = False
    errors = []

    for alert_info in alerts_to_notify:
        result = notification_service.notify_alert(alert_info)
        if result["whatsapp"]["success"]:
            whatsapp_ok = True
        elif result["whatsapp"].get("error"):
            errors.append(f"WhatsApp: {result['whatsapp']['error']}")
        if result["email"]["success"]:
            email_ok = True
        elif result["email"].get("error"):
            errors.append(f"Email: {result['email']['error']}")

    return AlertResponse(
        processed=len(aggregated),
        notifications_sent=NotificationResult(
            whatsapp=whatsapp_ok,
            email=email_ok,
            errors=list(set(errors)),
        ),
        state_changes=state_changes,
    )


@app.get("/api/v1/alerts", response_model=AlertStatesResponse)
async def get_alert_states():
    states = alert_state_machine.get_all_states()
    last_updated = getattr(alert_state_machine, "last_updated", None)

    return AlertStatesResponse(
        alert_states=states,
        last_updated=last_updated,
    )
