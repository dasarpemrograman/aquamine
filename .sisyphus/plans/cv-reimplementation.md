# CV Yellow Boy Detection Reimplementation

## Context

### Original Request
Reimplementasi Computer Vision untuk deteksi Yellow Boy (iron hydroxide precipitate) dari awal. Implementasi sebelumnya gagal total dengan confidence 6-44% (basically random/garbage). Perlu fresh start dari branch main.

### Interview Summary
**Key Discussions**:
- **Dataset**: Belum ada sama sekali - perlu scrape dari internet (50-100 gambar)
- **Approach**: Minimal fine-tuning dengan YOLOv8/11 + heavy augmentation
- **Training**: Google Colab (free GPU)
- **Backend**: FastAPI (existing skeleton di `ai/main.py`)
- **Testing**: Include automated tests
- **Demo Priority**: Balanced - CV hanya salah satu komponen

**Research Findings**:
- NO public yellow boy datasets exist - must collect ourselves
- Transfer learning dari water pollution models viable (WATER-DET: 77.3% mAP@0.5)
- DroneWQ library available untuk multispectral processing
- Estimated 1-2 weeks untuk minimal fine-tuning approach

### Metis Review
**Identified Gaps** (addressed in plan):
- Need explicit "Definition of Yellow Boy" labeling rules
- Need mock detector mode for testing before model exists
- Need clear API contract definition early
- Must lock scope to prevent creep (no drone pipeline, no PostGIS, no auth)
- Must plan for edge cases (no detection, multiple detections, false positives)

---

## Definition of Yellow Boy

### What IS Yellow Boy (Label as Positive)
- Yellow/orange iron hydroxide precipitate in water bodies
- Iron oxide deposits on rocks/sediment near water
- Orange-brown discoloration of water indicating AMD
- Rusty-colored sediment in drainage channels
- Visible iron precipitation at water surface

### What is NOT Yellow Boy (Do Not Label)
- Yellow autumn leaves or vegetation
- Yellow/orange sand or natural soil
- Algae blooms (green-yellow)
- Reflections or lighting artifacts
- Rust on man-made structures (pipes, machinery)
- Muddy brown water without iron signature

### Labeling Rules
- Use **bounding boxes** (not segmentation)
- Minimum box size: 20x20 pixels
- If multiple patches visible, label each separately
- If unsure, don't label (better to miss than mislabel)
- Include variety: different lighting, angles, water types

---

## Work Objectives

### Core Objective
Implement working Computer Vision detection for Yellow Boy with >70% confidence on real-world test images, integrated into FastAPI backend with frontend upload interface.

### Concrete Deliverables
1. Dataset collection guide + labeled dataset (50-100 images in Roboflow)
2. Google Colab training notebook for YOLOv8
3. Trained model weights (`best.pt`)
4. FastAPI endpoint `POST /api/v1/cv/analyze`
5. Frontend upload + results display component
6. Automated tests for API and mock inference

### Definition of Done
- [ ] Model achieves >70% confidence on held-out test images (10-15 images)
  - **Pass criteria**: For each positive test image, at least 1 bbox with `confidence >= 0.7`
  - **Fail criteria**: Any positive image with all detections `< 0.5` confidence
  - **Negative test**: For negative images, `detected=false` OR all `confidence < 0.3`
- [x] API endpoint returns valid JSON with bounding boxes and confidence
- [x] Frontend displays uploaded image with detection overlay
- [x] All automated tests pass
- [x] No CORS errors in browser console

### Must Have
- Mock inference mode (works without trained model for development/testing)
- Clear error messages for invalid uploads
- Support for JPG/PNG images up to 10MB
- Detection results with bounding boxes + confidence scores

### Must NOT Have (Guardrails)
- NO drone/multispectral pipeline (out of scope)
- NO database integration (PostgreSQL/TimescaleDB) in this plan
- NO authentication/authorization
- NO GenAI chatbot integration
- NO complex annotation UI (use Roboflow external service)
- NO video processing (images only)
- NO "improvements" to unrelated backend code
- NO premature optimization (inference speed, caching)

---

## Verification Strategy

### Python Toolchain
The `ai/` directory uses `pyproject.toml` with Python 3.11+. For local development:
- **Option A (uv)**: Install `uv` first (`curl -LsSf https://astral.sh/uv/install.sh | sh`), then use `uv run` commands
- **Option B (pip)**: Create venv and install: `python -m venv .venv && source .venv/bin/activate && pip install -e .`
- **Docker**: Uses `pip install .` as per `ai/Dockerfile`

**This plan assumes `uv` for local development.** If `uv` is not installed, substitute commands:
- `uv run pytest` → `pytest` (after `pip install -e ".[dev]"`)
- `uv run uvicorn` → `uvicorn` (after `pip install -e .`)

### Python Import Strategy
Backend code runs from `ai/` directory with `uvicorn main:app`. Imports are relative to `ai/`:
- `from schemas.cv import ImageAnalysisResponse, BoundingBox, ErrorResponse`
- `from cv.detector import YellowBoyDetector, Detection`

The `ai/` directory is NOT a package (no `ai/__init__.py`). All imports assume CWD is `ai/`.

### Model Path Resolution
The detector uses path relative to its own file location (NOT CWD):
```python
import os
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'best.pt')
# Resolves to: ai/models/best.pt regardless of CWD
```

This means:
- `ai/cv/detector.py` looks for `ai/models/best.pt`
- Works whether running from `ai/` or project root
- Task 3: Create detector with this path resolution
- Task 7: Place trained model at `ai/models/best.pt`

### Test Decision
- **Infrastructure exists**: NO (pytest cache exists but no actual tests)
- **User wants tests**: YES
- **Framework**: pytest for backend, vitest/jest for frontend (if needed)

### Test Structure
Each TODO includes verification steps. Tests will use mock inference during development.

**Backend Tests:**
- API contract tests (request/response schema)
- File validation tests (size, format, corrupted)
- Mock inference path tests
- Error handling tests

**Manual Verification:**
- Upload real yellow boy images via frontend
- Verify bounding boxes display correctly
- Test edge cases (no detection, multiple detections)

---

## Task Flow

```
[PHASE 1: SETUP - Parallelizable]
Task 1 (Dataset Guide) ─┬─ Task 2 (API Contract) ─┬─ Task 3 (Mock Inference)
                        │                         │
[PHASE 2: IMPLEMENTATION]│                        │
                        ▼                         ▼
                    Task 4 (FastAPI Endpoint) ────────┐
                                                      │
                    Task 5 (Backend Tests) ◄──────────┤
                                                      │
[PHASE 3: FRONTEND]                                   │
                    Task 6 (Frontend Upload) ◄────────┘
                        │
                        ▼
[PHASE 4: TRAINING - USER INTERVENTION REQUIRED]
                    ⏸️ STOP: User collects dataset
                    ⏸️ STOP: User labels in Roboflow
                    ⏸️ STOP: User trains in Colab
                        │
                        ▼
                    Task 7 (Integrate Real Model)
                        │
                        ▼
                    Task 8 (End-to-End Verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2, 3 | Independent setup tasks |
| B | 4, 5 | API implementation + tests (sequential) |
| C | 6 | Depends on API contract (Task 2) |

| Task | Depends On | Reason |
|------|------------|--------|
| 4 | 2, 3 | Needs API contract and mock inference |
| 5 | 4 | Tests the endpoint |
| 6 | 2 | Needs API contract for integration |
| 7 | User intervention | Requires trained model |
| 8 | 7 | Verification after model integration |

---

## TODOs

### Phase 1: Setup (Parallelizable)

- [x] 1. Create Dataset Collection Guide

  **What to do**:
  - Create `docs/dataset-guide.md` with:
    - Yellow boy definition and labeling rules
    - Search queries for Google Images (`"acid mine drainage" yellow`, `"iron hydroxide" water`, `"yellow boy" mining`, `AMD precipitate`)
    - Roboflow project setup instructions (free tier)
    - Export format: YOLOv8 (txt annotations)
    - Recommended split: 70% train, 20% val, 10% test
    - Quality checklist for images

  **Must NOT do**:
  - Don't collect the images (user responsibility)
  - Don't create complex scraping scripts

  **Parallelizable**: YES (with 2, 3)

  **References**:
  - `docs/aquamine-brainstorming/RESEARCH_COMPILATION.md:318-321` - Yellow Boy RGB signature (R:180-220, G:140-180, B:60-120)
  - `docs/aquamine-brainstorming/AQUAMINE_AGENT_BRIEF.md:80` - Yellow Boy as early visual indicator

  **Acceptance Criteria**:
   - [x] File created: `docs/dataset-guide.md`
   - [x] Contains at least 5 search query examples
   - [x] Contains Roboflow setup steps
   - [x] Contains labeling rules from this plan

  **Commit**: YES
  - Message: `docs: add dataset collection guide for yellow boy detection`
  - Files: `docs/dataset-guide.md`

---

- [x] 2. Define API Contract

  **What to do**:
  - Create `ai/schemas/cv.py` with Pydantic models:
    - `BoundingBox`:
      - `x: int` - left edge in pixels (origin: top-left, 0-indexed)
      - `y: int` - top edge in pixels
      - `width: int` - box width in pixels
      - `height: int` - box height in pixels
      - `confidence: float` - detection confidence (0.0-1.0)
    - `ImageAnalysisResponse`:
      - `detected: bool` - True if any detection with confidence >= 0.3 (hardcoded threshold)
      - `confidence: float` - highest confidence among all detections (0.0 if none)
      - `severity: Literal["none", "mild", "moderate", "severe"]`
      - `bbox: BoundingBox | None` - primary detection (highest confidence), null if none
      - `bboxes: list[BoundingBox]` - all detections, empty list if none
      - `latency_ms: int` - inference time in milliseconds
      - `warnings: list[str]` - e.g., "Image smaller than 200x200; resized for processing"
      - `model_version: str` - "mock-v1" or "yolov8n-yellowboy-v1"
      - `image_width: int` - original image width
      - `image_height: int` - original image height
    - `ErrorResponse`:
      - `error: str` - error code (e.g., "INVALID_FILE_TYPE", "FILE_TOO_LARGE")
      - `detail: str` - human-readable message
  - Add `python-multipart` to dependencies in `ai/pyproject.toml` (required for file uploads)
  - Add `pillow` to dependencies (required for image dimension reading)
  
  **Exact dependency strings for `ai/pyproject.toml`**:
  ```toml
  dependencies = [
      # ... existing deps ...
      "python-multipart>=0.0.9",
      "pillow>=10.0.0",
  ]
  ```

  **Coordinate System**:
  - Origin: top-left corner of image
  - Units: pixels (integers)
  - Box: (x, y) is top-left corner, width/height are positive integers
  - All coordinates are 0-indexed

  **Detection Semantics**:
  - 0 detections: `detected=false`, `confidence=0.0`, `bbox=null`, `bboxes=[]`
  - 1 detection: `detected=true`, `confidence=det.conf`, `bbox=det`, `bboxes=[det]`
  - N detections: `detected=true`, `confidence=max(confs)`, `bbox=highest_conf`, `bboxes=[all]`

  **Error Response Examples**:
  ```json
  // 400 Bad Request - Invalid file type
  {"error": "INVALID_FILE_TYPE", "detail": "Only JPG and PNG images are supported. Received: application/pdf"}
  
  // 413 Payload Too Large
  {"error": "FILE_TOO_LARGE", "detail": "File size exceeds 10MB limit. Received: 15.2MB"}
  
  // 422 Unprocessable Entity - Missing file
  {"error": "MISSING_FILE", "detail": "No file was uploaded. Use 'file' field in multipart form."}
  
  // 422 Unprocessable Entity - Image decode failed
  {"error": "IMAGE_DECODE_FAILED", "detail": "Could not decode image. File may be corrupted or not a valid image."}
  
  // 500 Internal Server Error - Inference failed
  {"error": "INFERENCE_FAILED", "detail": "Model inference failed. Please try again."}
  ```

  **Error Response Implementation Strategy**:
  - Use `JSONResponse` with custom status codes (NOT `HTTPException`) to ensure consistent `{"error": "...", "detail": "..."}` shape
  - Create helper in `ai/utils/responses.py`:
    ```python
    from fastapi.responses import JSONResponse
    
    def error_response(status: int, error: str, detail: str) -> JSONResponse:
        return JSONResponse(status_code=status, content={"error": error, "detail": detail})
    ```
  - For 422 MISSING_FILE: Use `file: UploadFile | None = File(None)` then check `if file is None:`
  - **Complete error handling examples**:
    ```python
    # 400 - Invalid file type
    if file.content_type not in ["image/jpeg", "image/png"]:
        return error_response(400, "INVALID_FILE_TYPE", f"Only JPG and PNG supported. Received: {file.content_type}")
    
    # 413 - File too large
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        return error_response(413, "FILE_TOO_LARGE", f"File exceeds 10MB limit. Received: {len(content) / 1024 / 1024:.1f}MB")
    
    # 422 - Missing file
    if file is None:
        return error_response(422, "MISSING_FILE", "No file uploaded. Use 'file' field in multipart form.")
    
    # 422 - Decode failed
    try:
        img = Image.open(io.BytesIO(content))
    except Exception:
        return error_response(422, "IMAGE_DECODE_FAILED", "Could not decode image. File may be corrupted.")
    
    # 500 - Inference failed
    try:
        detections, warnings = detector.detect(content, img.size[0], img.size[1])
    except Exception as e:
        return error_response(500, "INFERENCE_FAILED", f"Model inference failed: {str(e)}")
    ```

  **Must NOT do**:
  - Don't implement the endpoint yet
  - Don't add database models

  **Parallelizable**: YES (with 1, 3)

  **References**:
  - `ai/main.py:1-9` - Current FastAPI app structure
  - `ai/pyproject.toml:7-14` - Available dependencies (pydantic>=2.9.0)

  **Acceptance Criteria**:
   - [x] File created: `ai/schemas/cv.py`
   - [x] File created: `ai/schemas/__init__.py`
   - [x] `python-multipart` added to `ai/pyproject.toml` dependencies
   - [x] `Pillow` added to `ai/pyproject.toml` dependencies
   - [x] All Pydantic models have type hints
   - [x] Response includes: detected, confidence, bbox, bboxes, latency_ms, model_version, image_width, image_height
   - [x] ErrorResponse model defined with error codes
   - [x] Severity enum: "none", "mild", "moderate", "severe"

  **Commit**: YES
  - Message: `feat(api): add CV analysis request/response schemas`
  - Files: `ai/schemas/__init__.py`, `ai/schemas/cv.py`, `ai/pyproject.toml`

---

- [x] 3. Implement Mock Inference Module

  **What to do**:
  - Create `ai/cv/detector.py` with:
    - `Detection` dataclass (internal representation):
      ```python
      @dataclass
      class Detection:
          x: int       # left edge in pixels
          y: int       # top edge in pixels
          width: int   # box width
          height: int  # box height
          confidence: float  # 0.0-1.0
      ```
    - `YellowBoyDetector` class
    - `detect(image_bytes: bytes) -> tuple[list[Detection], list[str]]` method (returns detections + warnings)
    - Mock mode: returns deterministic fake detections based on image hash
    - Real mode: loads YOLO model and runs inference (placeholder for now)
    - Auto-detect mode based on whether `ai/models/best.pt` exists
  - Create `ai/cv/__init__.py` with exports: `YellowBoyDetector`, `Detection`
  - Create empty directory `ai/models/` with `.gitkeep`

  **Detection Return Type with Warnings**:
  The detector returns a tuple to propagate warnings:
  ```python
  def detect(self, image_bytes: bytes) -> tuple[list[Detection], list[str]]:
      """
      Returns: (detections, warnings)
      - detections: list of Detection objects
      - warnings: list of warning messages (e.g., small image, low confidence)
      """
  ```
  Note: This is the ONLY return type. The `-> list[Detection]` mentioned in "What to do" is incorrect; always use tuple.

  **Mock Inference Specification (Deterministic)**:
  The mock detector MUST produce consistent, deterministic results for the same image:
  
  ```python
  import hashlib
  
  def _mock_detect(self, image_bytes: bytes, img_width: int, img_height: int) -> list[Detection]:
      # Use SHA256 for deterministic hash (not affected by PYTHONHASHSEED)
      hash_bytes = hashlib.sha256(image_bytes[:1024]).digest()
      hash_val = int.from_bytes(hash_bytes[:8], 'big')
      
      # Determine number of detections (0-3 based on hash)
      num_detections = hash_val % 4
      
      if num_detections == 0:
          return []
      
      # Handle small images: if image < 100x100, return empty with warning
      if img_width < 100 or img_height < 100:
          # Caller should add warning: "Image smaller than 100x100; detection skipped"
          return []
      
      detections = []
      for i in range(num_detections):
          # Deterministic box coords within image bounds
          seed = hash_val + i * 12345
          # Ensure coords stay within valid range
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
          detections.append(Detection(x=int(x), y=int(y), width=int(w), height=int(h), confidence=conf))
      
      return sorted(detections, key=lambda d: d.confidence, reverse=True)
  ```

  **Small Image Handling**:
  - If image width OR height < 100px: return empty detections
  - Add warning to response: `"Image smaller than 100x100; detection may be unreliable"`
  - Do NOT resize - just warn and return empty

  **Image Decoding**:
  - Use Pillow to decode image and get dimensions
  - If decode fails, raise `ImageDecodeError` (caught by endpoint)

  **Real Mode and ultralytics Dependency**:
  - Real mode requires `ultralytics` package, but it's only added in Task 7
  - Use **lazy import** to avoid breaking when ultralytics not installed:
    ```python
    def _load_model(self):
        if self._model is None and self._model_path.exists():
            try:
                from ultralytics import YOLO  # Lazy import
                self._model = YOLO(str(self._model_path))
            except ImportError:
                # ultralytics not installed yet, fall back to mock
                pass
        return self._model
    ```
  - Before Task 7: If model file exists but ultralytics not installed → use mock mode
  - After Task 7: ultralytics installed → real inference works

  **Must NOT do**:
  - Don't train the model
  - Don't download pre-trained weights yet

  **Parallelizable**: YES (with 1, 2)

  **References**:
  - Ultralytics YOLOv8 API: `from ultralytics import YOLO; model = YOLO("best.pt"); results = model(image)`
  - `ai/main.py` - Current app structure

  **Acceptance Criteria**:
   - [x] File created: `ai/cv/detector.py`
   - [x] File created: `ai/cv/__init__.py`
   - [x] `Detection` dataclass defined in `ai/cv/detector.py`
   - [x] `detect()` returns `tuple[list[Detection], list[str]]` (detections, warnings)
   - [x] Directory created: `ai/models/` with `.gitkeep`
   - [x] Model path resolved via `__file__` (not CWD)
   - [x] Mock mode works without any model file
   - [x] Mock returns 0-3 detections based on SHA256 hash
   - [x] Mock bbox coords always within image bounds
   - [x] Same image bytes → same detection results (deterministic)
   - [x] Real mode loads model from `ai/models/best.pt` when exists
   - [x] `ImageDecodeError` raised for corrupted/invalid images
   - [x] Warning added when image < 100x100

  **Commit**: YES
  - Message: `feat(cv): add yellow boy detector with mock inference mode`
  - Files: `ai/cv/__init__.py`, `ai/cv/detector.py`, `ai/models/.gitkeep`

---

### Phase 2: Backend Implementation

- [x] 4. Implement CV Analysis Endpoint

  **What to do**:
  - Add `POST /api/v1/cv/analyze` endpoint to `ai/main.py`
  - Accept image upload (multipart/form-data)
  - Validate file type (JPG/PNG) and size (max 10MB)
  - Call `YellowBoyDetector.detect()` and map results:
    ```python
    # detect() returns (detections, warnings) tuple
    detections, warnings = detector.detect(image_bytes)
    bboxes = [
        BoundingBox(x=d.x, y=d.y, width=d.width, height=d.height, confidence=d.confidence)
        for d in detections
    ]
    # Build response
    highest = max(bboxes, key=lambda b: b.confidence) if bboxes else None
    max_conf = highest.confidence if highest else 0.0
    response = ImageAnalysisResponse(
        detected=len(bboxes) > 0 and max_conf >= 0.3,  # Detection threshold = 0.3
        confidence=max_conf,
        severity=calculate_severity(max_conf),
        bbox=highest,
        bboxes=bboxes,
        latency_ms=elapsed_ms,
        warnings=warnings,  # Pass through from detector
        model_version=detector.version,
        image_width=img_width,
        image_height=img_height,
    )
    ```
  - Return response matching schema from Task 2
  - Add CORS middleware for frontend access
  - Handle `ImageDecodeError` → 422 with IMAGE_DECODE_FAILED
  - Handle inference exceptions → 500 with INFERENCE_FAILED

  **Threshold Semantics (IMPORTANT)**:
  - **API `detected` field**: Uses 0.3 threshold (any bbox >= 0.3 → `detected=true`)
  - **Model quality evaluation (DoD)**: Uses 0.7 threshold (good model = positive images get >= 0.7)
  - These are DIFFERENT purposes: API shows "something found", DoD measures "model accuracy"
  
  **Severity thresholds** (for `severity` field):
    - confidence < 0.3: "none"
    - 0.3 <= confidence < 0.5: "mild"
    - 0.5 <= confidence < 0.7: "moderate"
    - confidence >= 0.7: "severe"

  **File Upload Validation Rules** (strict order):
  1. **Check file presence**: If no file → 422 `MISSING_FILE`
  2. **Check file size** (read file into memory, check `len(content)`):
     ```python
     content = await file.read()
     if len(content) > 10 * 1024 * 1024:  # 10MB
         raise HTTPException(413, detail={"error": "FILE_TOO_LARGE", ...})
     ```
     Note: FastAPI `UploadFile.size` is unreliable; always read and check length.
  3. **Check content type**: Accept `image/jpeg`, `image/png` only. Reject others → 400 `INVALID_FILE_TYPE`
  4. **Decode image**: Use `PIL.Image.open(io.BytesIO(content))`. If fails → 422 `IMAGE_DECODE_FAILED`
  5. **Run inference**: If exception → 500 `INFERENCE_FAILED`

  **Validation → HTTP Status Mapping**:
  | Condition | HTTP Status | Error Code |
  |-----------|-------------|------------|
  | No file uploaded | 422 | MISSING_FILE |
  | File too large (>10MB) | 413 | FILE_TOO_LARGE |
  | Invalid content type | 400 | INVALID_FILE_TYPE |
  | Image decode fails | 422 | IMAGE_DECODE_FAILED |
  | Inference exception | 500 | INFERENCE_FAILED |
  | Success | 200 | (no error) |

  **Force Mock Mode for Testing**:
  - Add environment variable `AQUAMINE_FORCE_MOCK=1` to force mock inference
  - Detector checks this at init:
    ```python
    import os
    self._force_mock = os.getenv("AQUAMINE_FORCE_MOCK", "0") == "1"
    ```
  - Tests set this env var to ensure deterministic behavior even after real model is added
  - Prevents test flakiness when `best.pt` + `ultralytics` are present

  **Detector Initialization**:
  - Create singleton at module scope in `ai/main.py`:
    ```python
    from cv.detector import YellowBoyDetector
    detector = YellowBoyDetector()  # Initialized once at startup
    ```
  - Model loaded once at startup, not per-request
  - `latency_ms` measures only inference time, not model loading

  **Must NOT do**:
  - Don't add database logging
  - Don't add authentication
  - Don't add rate limiting

  **Parallelizable**: NO (depends on 2, 3)

  **References**:
  - `ai/main.py:1-9` - Current FastAPI skeleton
  - `ai/schemas/cv.py` (from Task 2) - Response models
  - `ai/cv/detector.py` (from Task 3) - Detector class
  - FastAPI file upload: `from fastapi import UploadFile, File`

  **Acceptance Criteria**:
   - [x] Endpoint accessible: `POST /api/v1/cv/analyze`
   - [x] CORS enabled for `http://localhost:3000`
   - [x] Valid image returns 200 with detection results
   - [x] Invalid file type returns 400 with error message
   - [x] File too large returns 413 with error message
   - [x] `curl` test works:
     ```bash
     curl -X POST http://localhost:8000/api/v1/cv/analyze \
       -F "file=@test_image.jpg" \
       | jq
     ```
   - [x] Response includes `latency_ms` field

  **Commit**: YES
  - Message: `feat(api): add POST /cv/analyze endpoint with CORS`
  - Files: `ai/main.py`
  - Pre-commit: Manual curl test (pytest not yet available until Task 5):
    ```bash
    cd ai && uv run uvicorn main:app --reload &
    sleep 3
    curl -X POST http://localhost:8000/api/v1/cv/analyze -F "file=@test.jpg"
    kill %1
    ```

---

- [x] 5. Add Backend Tests

  **What to do**:
  - Create `ai/tests/test_cv_api.py` with pytest tests:
    - Test valid image upload returns 200
    - Test invalid file type (txt, pdf) returns 400
    - Test missing file returns 422
    - Test corrupted/unreadable image returns 422 with IMAGE_DECODE_FAILED
    - Test response schema matches contract
    - Test mock mode returns consistent results for same image
    - Test mock mode returns different results for different images
  - Create `ai/tests/conftest.py` with fixtures:
    - FastAPI test client (uses `httpx` via `TestClient`)
    - Sample test images generated inline via Pillow (not committed fixtures):
      ```python
      from PIL import Image
      import io
      
      @pytest.fixture
      def sample_jpg_bytes():
          img = Image.new('RGB', (200, 200), color='orange')
          buf = io.BytesIO()
          img.save(buf, format='JPEG')
          return buf.getvalue()
      ```
    - Force mock mode via environment:
      ```python
      @pytest.fixture(autouse=True)
      def force_mock_mode(monkeypatch):
          monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")
      ```
  - Add pytest and httpx to dev dependencies in pyproject.toml:
    ```toml
    [project.optional-dependencies]
    dev = [
        "ruff>=0.6.3",
        "pytest>=8.0.0",
        "httpx>=0.27.0",
    ]
    ```

  **Must NOT do**:
  - Don't test real model inference (not trained yet)
  - Don't test database operations

  **Parallelizable**: NO (depends on 4)

  **References**:
  - `ai/main.py` - FastAPI app to test
  - `ai/schemas/cv.py` - Response schema to validate
  - FastAPI testing: `from fastapi.testclient import TestClient`

  **Acceptance Criteria**:
   - [x] File created: `ai/tests/test_cv_api.py`
   - [x] File created: `ai/tests/conftest.py`
   - [x] At least 7 test cases (see list above)
   - [x] `cd ai && uv run pytest tests/ -v` → all tests pass
   - [x] Tests use mock inference mode
   - [x] Test for corrupted image returns 422 with IMAGE_DECODE_FAILED

  **Commit**: YES
  - Message: `test(api): add CV endpoint tests with mock inference`
  - Files: `ai/tests/conftest.py`, `ai/tests/test_cv_api.py`, `ai/pyproject.toml`
  - Pre-commit: `cd ai && uv run pytest tests/ -v`

---

### Phase 3: Frontend

- [x] 6. Implement Frontend Upload Component

  **What to do**:
  - Create `dashboard/app/cv/page.tsx` - CV analysis page
  - Create `dashboard/app/components/ImageUploader.tsx`:
    - Drag-and-drop or click to upload
    - Preview uploaded image
    - Show loading state during analysis
    - Display results (bounding boxes overlay, confidence, severity)
  - Add API client utility `dashboard/lib/api.ts`
  - Style with Tailwind CSS
  - Handle error states (API error, invalid file)
  - Create or update `dashboard/app/layout.tsx` to include navigation link to `/cv`
    - If layout.tsx is default Next.js template, add a simple nav header
    - Nav should include: Home ("/") and CV Analysis ("/cv")

  **Must NOT do**:
  - Don't add complex state management (Redux, Zustand)
  - Don't add authentication
  - Don't redesign entire dashboard

  **Parallelizable**: YES (after Task 2 API contract defined)

  **References**:
  - `dashboard/package.json:11-14` - Next.js 16, React 19
  - `dashboard/tsconfig.json` - TypeScript config
  - `ai/schemas/cv.py` - API response schema to display
  - Backend URL: `http://localhost:8000`

  **Acceptance Criteria**:
   - [x] Page accessible: `http://localhost:3000/cv`
   - [x] Navigation link visible from home page
   - [x] Can upload JPG/PNG via drag-drop or click
   - [x] Shows preview of uploaded image
   - [x] Displays detection results after API call
   - [x] Shows error message if API fails
   - [x] Bounding boxes drawn on image with correct scaling:
     - Use CSS overlay with `position: absolute` on container with `position: relative`
     - Scale bbox coords based on rendered vs natural image size:
       ```typescript
       const scaleX = renderedWidth / response.image_width;
       const scaleY = renderedHeight / response.image_height;
       const left = bbox.x * scaleX;
       const top = bbox.y * scaleY;
       const width = bbox.width * scaleX;
       const height = bbox.height * scaleY;
       ```
   - [x] Severity displayed with color coding (green=none, yellow=mild, orange=moderate, red=severe)

  **Manual Verification**:
  - Start frontend: `cd dashboard && npm run dev`
  - Open browser: `http://localhost:3000/cv`
  - Action: Upload a test image (any JPG/PNG)
  - Verify: Mock detection results displayed (since model not trained yet)
  - Verify: Bounding box overlay visible on image
  - Verify: No console errors

  **Commit**: YES
  - Message: `feat(dashboard): add CV analysis page with image upload`
  - Files: `dashboard/app/cv/page.tsx`, `dashboard/app/components/ImageUploader.tsx`, `dashboard/lib/api.ts`, `dashboard/app/layout.tsx`

---

### Phase 4: Training & Integration (USER INTERVENTION REQUIRED)

---

## ⏸️ STOP POINT: Dataset Collection & Training

**At this point, the system is ready but needs YOUR intervention:**

### What You Need To Do:

1. **Collect Images (1-2 hours)**
   - Use search queries from `docs/dataset-guide.md`
   - Download 50-100 yellow boy images
   - Include variety: lighting, angles, water types
   - Also include 20-30 negative examples (similar but not yellow boy)

2. **Create Roboflow Project (30 min)**
   - Go to roboflow.com (free tier)
   - Create project: "yellow-boy-detection"
   - Upload images
   - Label bounding boxes following rules in this plan
   - Split: 70% train, 20% val, 10% test
   - Export format: YOLOv8

3. **Train in Google Colab (1-2 hours)**
   - Open Ultralytics tutorial notebook:
     - GitHub (no login): https://github.com/ultralytics/ultralytics/blob/main/examples/tutorial.ipynb
     - Colab (requires login): https://colab.research.google.com/github/ultralytics/ultralytics/blob/main/examples/tutorial.ipynb
   - OR follow YOLOv8 training docs: https://docs.ultralytics.com/modes/train/
   - Upload Roboflow dataset (download as YOLOv8 format zip)
   - Train YOLOv8n for 50-100 epochs:
     ```python
     from ultralytics import YOLO
     model = YOLO('yolov8n.pt')  # Start from pretrained
     model.train(data='path/to/data.yaml', epochs=100, imgsz=640)
     ```
   - Download `runs/detect/train/weights/best.pt`

4. **Add Weights to Project**
   - Place `best.pt` in `ai/models/best.pt`
   - The detector will automatically switch to real mode

**When ready, continue with Task 7.**

---

- [ ] 7. Integrate Real Model

  **What to do**:
  - Copy trained `best.pt` to `ai/models/best.pt`
  - Update `ai/cv/detector.py` to verify model loads correctly
  - Add ultralytics to dependencies in pyproject.toml
  - Test with real images from test set
  - Verify confidence scores are reasonable (>70% for clear yellow boy)
  - Tune confidence threshold if needed

  **Must NOT do**:
  - Don't retrain the model
  - Don't add complex post-processing

  **Parallelizable**: NO (requires user to complete training first)

  **References**:
  - `ai/cv/detector.py` - Detector with mock/real mode
  - Roboflow export → `data.yaml` file for class names
  - Ultralytics inference: `model.predict(image, conf=0.25)`
  - Ultralytics result format: https://docs.ultralytics.com/reference/engine/results/

  **YOLO Output → BoundingBox Mapping**:
  Ultralytics returns boxes in `xyxy` format (float, pixel coords). Convert to our contract:
  ```python
  from ultralytics import YOLO
  
  results = model.predict(image, conf=0.25)
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
  ```

  **Acceptance Criteria**:
  - [ ] Model file exists: `ai/models/best.pt`
  - [ ] Detector loads model without errors
  - [ ] Real inference returns valid bounding boxes
  - [ ] Confidence scores are >50% for clear yellow boy images
  - [ ] API still works correctly with real model

  **Commit**: YES
  - Message: `feat(cv): integrate trained YOLOv8 model for yellow boy detection`
  - Files: `ai/cv/detector.py`, `ai/pyproject.toml`, `ai/.gitignore`
  - Note: Add `ai/.gitignore` with:
    ```
    # Ignore model weights (large binary files)
    models/*.pt
    models/*.onnx
    # Keep .gitkeep
    !models/.gitkeep
    ```

---

- [ ] 8. End-to-End Verification

  **What to do**:
  - Test full flow: Frontend → API → Real Model → Display Results
  - Test with 5-10 unseen yellow boy images
  - Test with 5-10 negative images (should return low confidence)
  - Document results in `docs/cv-test-results.md`
  - Take screenshots of successful detections

  **Must NOT do**:
  - Don't add new features
  - Don't optimize performance yet

  **Parallelizable**: NO (final verification)

  **References**:
  - All previous tasks
  - Test images from held-out test set

  **Acceptance Criteria**:
  - [ ] Frontend upload works with real model
  - [ ] True positives: >70% confidence for clear yellow boy
  - [ ] True negatives: <30% confidence for non-yellow-boy images
  - [ ] No errors in browser console
  - [ ] No errors in backend logs
  - [ ] Documentation created: `docs/cv-test-results.md`

  **Manual Verification**:
  - Start backend: `cd ai && uv run uvicorn main:app --reload`
  - Start frontend: `cd dashboard && npm run dev`
  - Open browser: `http://localhost:3000/cv`
  - Action: Upload 3 different yellow boy images from test set
  - Verify: All show "detected: true" with confidence >50%
  - Action: Upload 2 non-yellow-boy images
  - Verify: Show "detected: false" or very low confidence (<30%)
  - Screenshot: Save evidence manually to `docs/cv-test-results.md`

  **Commit**: YES
  - Message: `docs: add CV test results documentation`
  - Files: `docs/cv-test-results.md`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `docs: add dataset collection guide for yellow boy detection` | `docs/dataset-guide.md` | File exists |
| 2 | `feat(api): add CV analysis request/response schemas` | `ai/schemas/` | Type check |
| 3 | `feat(cv): add yellow boy detector with mock inference mode` | `ai/cv/` | Unit test |
| 4 | `feat(api): add POST /cv/analyze endpoint with CORS` | `ai/main.py` | curl test |
| 5 | `test(api): add CV endpoint tests with mock inference` | `ai/tests/` | pytest |
| 6 | `feat(dashboard): add CV analysis page with image upload` | `dashboard/app/cv/`, `dashboard/app/layout.tsx` | Manual browser |
| 7 | `feat(cv): integrate trained YOLOv8 model` | `ai/cv/`, `ai/pyproject.toml` | Inference test |
| 8 | `docs: add CV test results documentation` | `docs/cv-test-results.md` | E2E test |

---

## Success Criteria

### Verification Commands
```bash
# Backend tests
cd ai && uv run pytest tests/ -v

# Start backend
cd ai && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Test endpoint
curl -X POST http://localhost:8000/api/v1/cv/analyze \
  -F "file=@test_image.jpg" | jq

# Start frontend
cd dashboard && npm run dev

# Open browser
open http://localhost:3000/cv
```

### Final Checklist
- [x] All "Must Have" present:
   - [x] Mock inference mode
   - [x] Clear error messages
   - [x] JPG/PNG support up to 10MB
   - [x] Bounding boxes + confidence
- [x] All "Must NOT Have" absent:
   - [x] No database code
   - [x] No auth code
   - [x] No drone pipeline
   - [x] No GenAI integration
- [x] All tests pass
- [ ] Model achieves >70% confidence on test set
- [x] No CORS errors in browser

---

## Remaining Notes (After This Plan)

After CV is complete, the following components still need implementation for the full AquaMine demo:

1. **Time-series Prediction (LSTM/TimeGPT)**
   - Predict pH 7 days ahead
   - Requires sensor data simulator
   - Separate plan needed

2. **Dashboard Enhancements**
   - Real-time WebSocket updates
   - Heatmap visualization
   - Alert management

3. **IoT Sensor Integration**
   - MQTT broker setup
   - Sensor data ingestion

4. **Notification System**
   - WhatsApp/Email alerts
   - Threshold-based triggers

Create separate plans for each as needed.
