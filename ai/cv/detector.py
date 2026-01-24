import hashlib
import os
import io
import logging
from dataclasses import dataclass
from pathlib import Path
from PIL import Image


logger = logging.getLogger(__name__)


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
        self._force_mock = os.getenv("AQUAMINE_FORCE_MOCK", "0") == "1"

    @property
    def version(self) -> str:
        if self._force_mock:
            return "mock-v1-forced"
        if not self._model_path.exists():
            return "mock-v1-no-model"

        if self._load_model() is None:
            return "mock-v1-import-failed"

        return "yolov8n-yellowboy-v1"

    @property
    def is_mock(self) -> bool:
        return self._force_mock or not self._model_path.exists()

    def _load_model(self):
        """Lazy load the YOLO model if available."""
        if self._model is None and self._model_path.exists() and not self._force_mock:
            try:
                from ultralytics import YOLO  # Lazy import

                self._model = YOLO(str(self._model_path))
            except ImportError as e:
                # ultralytics not installed yet, fall back to mock
                logger.warning(f"Failed to import ultralytics, falling back to mock: {e}")
                pass
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}")
                pass
        return self._model

    def detect(
        self, image_bytes: bytes, img: Image.Image | None = None
    ) -> tuple[list[Detection], list[str]]:
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
            return self._real_detect(model, img, img_width, img_height, warnings)

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
        self, model, img: Image.Image, img_width: int, img_height: int, warnings: list[str]
    ) -> tuple[list[Detection], list[str]]:
        """Run real YOLO inference."""
        # Run inference directly with PIL Image
        results = model.predict(img, conf=0.25, verbose=False)

        detections = []
        for result in results:
            for box in result.boxes:
                # box.xyxy is tensor [[x1, y1, x2, y2]]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                # Convert xyxy → xywh (our contract format)
                x = int(round(x1))
                y = int(round(y1))
                width = int(round(x2 - x1))
                height = int(round(y2 - y1))
                detections.append(Detection(x=x, y=y, width=width, height=height, confidence=conf))

        return sorted(detections, key=lambda d: d.confidence, reverse=True), warnings
