from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import io
import time
from PIL import Image

from schemas.cv import BoundingBox, ImageAnalysisResponse
from cv.detector import YellowBoyDetector, ImageDecodeError
from utils.responses import error_response

app = FastAPI(title="AquaMine AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = YellowBoyDetector()


def calculate_severity(confidence: float) -> str:
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
        detections, warnings = detector.detect(content)
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
        detected=len(bboxes) > 0 and max_conf >= 0.3,
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
