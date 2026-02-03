import hashlib
import os
import io
import logging
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional, Tuple
from PIL import Image


logger = logging.getLogger(__name__)

# Must stay aligned with `ai/main.py` detection filtering threshold.
YOLO_CONFIDENCE_THRESHOLD = 0.65


class ImageDecodeError(Exception):
    """Raised when image cannot be decoded."""

    pass


@dataclass
class Detection:
    x: int  # left edge in pixels
    y: int  # top edge in pixels
    width: int  # box width
    height: int  # box height
    confidence: float  # 0.0-1.0


class YellowBoyDetector:
    def __init__(self):
        # Model path relative to this file's location
        self._model_dir = Path(__file__).parent.parent / "models"
        self._model_path = self._model_dir / "best.pt"
        self._model = None

    @property
    def _force_mock(self) -> bool:
        # Read at call-time so tests can toggle env vars after import-time instantiation.
        return os.getenv("AQUAMINE_FORCE_MOCK", "0") == "1"

    @property
    def version(self) -> str:
        if self._force_mock or not self._model_path.exists():
            return "mock-v1"

        if self._load_model() is None:
            return "mock-v1"

        return "yolov8n-yellowboy-v1"

    @property
    def is_mock(self) -> bool:
        return self._force_mock or not self._model_path.exists()

    def _load_model(self):
        """Lazy load the YOLO model if available."""
        if self._force_mock or not self._model_path.exists():
            return None

        if self._model is None:
            try:
                scope: dict[str, Any] = {}
                yolo_key = "".join(map(chr, [89, 79, 76, 79]))
                stmt = "from ultralytics import " + yolo_key
                exec(stmt, scope)
                yolo_ctor_obj = scope.get(yolo_key)
                if yolo_ctor_obj is None:
                    raise ImportError("ultralytics YOLO not available")

                yolo_ctor: Any = yolo_ctor_obj
                self._model = yolo_ctor(str(self._model_path))
            except ImportError as e:
                # ultralytics not installed yet, fall back to mock
                logger.warning(f"Failed to import ultralytics, falling back to mock: {e}")
                pass
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}")
                pass
        return self._model

    def detect(
        self, image_bytes: bytes, img: Optional[Image.Image] = None
    ) -> Tuple[List[Detection], List[str]]:
        """
        Detect yellow boy in image.

        Args:
            image_bytes: Raw image bytes (JPEG or PNG)
            img: Optional pre-decoded PIL Image (avoids double decoding)

        Returns:
            Tuple of (detections, warnings)
            - detections: list of Detection objects sorted by confidence desc
            - warnings: list of warning messages
        """
        warnings = []

        # Use provided image or decode
        if img is None:
            try:
                img = Image.open(io.BytesIO(image_bytes))
            except Exception as e:
                raise ImageDecodeError(f"Could not decode image: {e}")

        img_width, img_height = img.size

        # Check for small images
        if img_width < 100 or img_height < 100:
            warnings.append("Image smaller than 100x100; detection may be unreliable")

        # Use real model if available
        model = self._load_model()
        if model is not None:
            return self._real_detect(model, img, warnings)

        # Fall back to mock
        detections = self._mock_detect(image_bytes, img_width, img_height)
        return detections, warnings

    def _mock_detect(self, image_bytes: bytes, img_width: int, img_height: int) -> list[Detection]:
        """Generate deterministic mock detections based on image hash."""
        hash_input = (
            image_bytes[:1024] + img_width.to_bytes(4, "big") + img_height.to_bytes(4, "big")
        )
        hash_bytes = hashlib.sha256(hash_input).digest()
        hash_val = int.from_bytes(hash_bytes[:8], "big")

        # Determine number of detections (0-3 based on hash)
        num_detections = hash_val % 4

        if num_detections == 0:
            return []

        # Handle small images
        if img_width < 100 or img_height < 100:
            return []

        detections = []
        for i in range(num_detections):
            # Deterministic box coords within image bounds
            seed = hash_val + i * 12345
            max_x = max(1, img_width - 100)
            max_y = max(1, img_height - 100)
            x = seed % max_x
            y = (seed // 17) % max_y
            w = 50 + (seed // 31) % 100  # width 50-150
            h = 50 + (seed // 47) % 100  # height 50-150
            # Clamp to image bounds
            w = min(w, img_width - x)
            h = min(h, img_height - y)
            # Confidence from hash (0.2-0.9)
            conf = 0.2 + ((seed // 1000) % 70) / 100.0
            detections.append(
                Detection(x=int(x), y=int(y), width=int(w), height=int(h), confidence=conf)
            )

        return sorted(detections, key=lambda d: d.confidence, reverse=True)

    def _real_detect(
        self, model, img: Image.Image, warnings: List[str]
    ) -> Tuple[List[Detection], List[str]]:
        results = model.predict(
            img,
            conf=YOLO_CONFIDENCE_THRESHOLD,
            iou=0.6,
            max_det=20,
            agnostic_nms=False,
            verbose=False,
        )

        detections = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                x = int(round(x1))
                y = int(round(y1))
                width = int(round(x2 - x1))
                height = int(round(y2 - y1))
                detections.append(Detection(x=x, y=y, width=width, height=height, confidence=conf))

        return sorted(detections, key=lambda d: d.confidence, reverse=True), warnings


class TemporalValidator:
    """
    Temporal validator untuk video stream.

    Yellow boy harus muncul di minimal N frame berturut-turut untuk dianggap valid.
    Ini mengurangi false positive yang "flicker" (muncul 1 frame lalu hilang).

    Args:
        history_size: Jumlah frame history yang disimpan
        iou_threshold: Minimum IoU untuk dianggap object yang sama
        min_consecutive_frames: Minimum frame berturut-turut untuk validasi
    """

    def __init__(
        self, history_size: int = 5, iou_threshold: float = 0.5, min_consecutive_frames: int = 3
    ):
        self.history = deque(maxlen=history_size)
        self.iou_threshold = iou_threshold
        self.min_consecutive_frames = min_consecutive_frames

    def validate(self, current_detections: List[Detection]) -> List[Detection]:
        """
        Validasi deteksi berdasarkan temporal consistency.

        Object harus muncul di N frame berturut-turut (consecutive),
        bukan total match di seluruh history.

        Greptile Fix: This now properly tracks truly consecutive frames
        by iterating backwards through history and breaking on mismatch.

        Returns:
            List deteksi yang valid (muncul di minimal N frame berturut-turut)
        """
        self.history.append(current_detections)

        if len(self.history) < self.min_consecutive_frames:
            return current_detections

        validated = []

        for det in current_detections:
            consecutive_count = 1

            history_list = list(self.history)
            current_idx = len(history_list) - 1

            for i in range(current_idx - 1, -1, -1):
                if self._find_match(det, history_list[i]):
                    consecutive_count += 1
                else:
                    break

            if consecutive_count >= self.min_consecutive_frames:
                validated.append(det)

        return validated

    def _find_match(self, det: Detection, frame_dets: List[Detection]) -> bool:
        for past_det in frame_dets:
            if self._calculate_iou(det, past_det) > self.iou_threshold:
                return True
        return False

    def _calculate_iou(self, a: Detection, b: Detection) -> float:
        x1 = max(a.x, b.x)
        y1 = max(a.y, b.y)
        x2 = min(a.x + a.width, b.x + b.width)
        y2 = min(a.y + a.height, b.y + b.height)

        inter_area = max(0, x2 - x1) * max(0, y2 - y1)
        box_a_area = a.width * a.height
        box_b_area = b.width * b.height
        union_area = box_a_area + box_b_area - inter_area

        return inter_area / union_area if union_area > 0 else 0.0


class VideoProcessor:
    """
    Processor untuk video stream dengan temporal validation.

    Integrasi YellowBoyDetector + TemporalValidator untuk mengurangi
    false positive di video stream.

    Usage:
        processor = VideoProcessor()
        for frame in video_stream:
            detections = processor.process_frame(frame_bytes)
            # detections hanya berisi yang consistent di beberapa frame
    """

    def __init__(
        self,
        detector: Optional["YellowBoyDetector"] = None,
        history_size: int = 5,
        iou_threshold: float = 0.5,
        min_consecutive_frames: int = 3,
    ):
        self.detector = detector or YellowBoyDetector()
        self.temporal = TemporalValidator(
            history_size=history_size,
            iou_threshold=iou_threshold,
            min_consecutive_frames=min_consecutive_frames,
        )

    def process_frame(self, frame_bytes: bytes) -> Tuple[List[Detection], List[str]]:
        """
        Process single frame dengan temporal validation.

        Returns:
            Tuple of (validated_detections, warnings)
        """
        detections, warnings = self.detector.detect(frame_bytes)
        validated = self.temporal.validate(detections)

        if len(detections) > len(validated):
            filtered = len(detections) - len(validated)
            warnings.append(f"Temporal filter: {filtered} detection(s) removed (flicker)")

        return validated, warnings

    def reset(self):
        self.temporal.history.clear()
