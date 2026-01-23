from pydantic import BaseModel
from typing import Literal


class BoundingBox(BaseModel):
    x: int  # left edge in pixels (origin: top-left, 0-indexed)
    y: int  # top edge in pixels
    width: int  # box width in pixels
    height: int  # box height in pixels
    confidence: float  # detection confidence (0.0-1.0)


class ImageAnalysisResponse(BaseModel):
    confidence: float  # highest confidence among all detections (0.0 if none)
    severity: Literal[
        "none", "mild", "moderate", "severe"
    ]  # derive detected from severity != "none"
    bbox: BoundingBox | None  # primary detection (highest confidence), null if none
    bboxes: list[BoundingBox]  # all detections, empty list if none
    latency_ms: int  # inference time in milliseconds
    warnings: list[str]  # e.g., "Image smaller than 200x200"
    model_version: str  # "mock-v1" or "yolov8n-yellowboy-v1"
    image_width: int  # original image width
    image_height: int  # original image height


class ErrorResponse(BaseModel):
    error: str  # error code (e.g., "INVALID_FILE_TYPE", "FILE_TOO_LARGE")
    detail: str  # human-readable message
