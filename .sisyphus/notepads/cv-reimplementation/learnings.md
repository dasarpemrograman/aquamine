# CV Reimplementation Learnings

## Yellow Boy Detection Dataset

### Key Technical Details
- **RGB signature** from research: R:180-220, G:140-180, B:60-120
- **Spectral correlation**: 570-610 nm bands correlate with AMD severity
- **Detection ratio**: band 665/560 nm is characteristic indicator

### Roboflow Free Tier Limits
- 10,000 images max
- 3 projects max
- Sufficient for hackathon prototype

### Dataset Recommendations
- Minimum 200-500 images for initial training
- Include 20-30 negative examples (non-Yellow Boy)
- Use 70/20/10 train/val/test split
- Export in YOLOv8 format (txt annotations)

### Search Query Patterns
Best results from combining:
- `"acid mine drainage" yellow` - captures AMD context
- `"yellow boy" mining` - direct term search
- `iron hydroxide water` - chemical name approach

### Labeling Best Practices
- Bounding boxes only (not segmentation for YOLOv8)
- Minimum 20x20px to ensure detectability
- Annotate each patch separately
- Keep boxes tight to reduce false positives

## Frontend CV Implementation
- **Image Bounding Box Scaling**: Used `useRef` on the `img` element and an `onLoad` handler to capture the actual rendered dimensions (`clientWidth`, `clientHeight`). This is crucial because the API returns coordinates based on the original image resolution, but the UI renders it responsive/scaled.
- **Scaling Formula**: `scaleX = renderedWidth / originalWidth`.
- **Next.js 13+ App Router**: Used `use client` directive for the interactive uploader component, while keeping the page wrapper as a server component (though it's static).

## Session Summary (2026-01-22)

### Completed Tasks (1-6)
1. Dataset collection guide created
2. API contract defined (Pydantic schemas)
3. Mock inference module implemented
4. CV analysis endpoint with CORS
5. Backend tests (10 tests, all passing)
6. Frontend upload with drag-drop and bbox overlay

### Key Technical Decisions
- **Mock mode determinism**: SHA256 hash of first 1024 bytes ensures same image → same detections
- **Force mock env var**: `AQUAMINE_FORCE_MOCK=1` for testing
- **Detection threshold**: 0.3 for API `detected` field (separate from 0.7 model quality threshold)
- **Severity thresholds**: none <0.3, mild 0.3-0.5, moderate 0.5-0.7, severe ≥0.7
- **Error responses**: JSONResponse (not HTTPException) for consistent error shape

### Blocked Tasks (7-8)
Require user to provide trained model at `ai/models/best.pt`
