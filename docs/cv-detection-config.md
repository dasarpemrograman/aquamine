# CV Detection Configuration Guide

## Overview

Configuration for Yellow Boy (acid mine drainage) detection using YOLOv8n.

**Model**: `ai/models/best.pt` (YOLOv8n trained on Yellow Boy dataset)  
**Location**: `ai/cv/detector.py` → `_real_detect()` method

---

## Current Parameters (Production-Optimized)

```python
results = model.predict(
    img,
    conf=0.65,           # Confidence threshold
    iou=0.6,             # IoU threshold for NMS
    max_det=20,          # Max detections per image
    agnostic_nms=False,  # Class-agnostic NMS (irrelevant for single class)
    verbose=False
)
```

### Backend Filtering

```python
# ai/main.py
DETECTION_THRESHOLD = 0.65  # Must match YOLO conf threshold
```

---

## Parameter Explanations

### 1. Confidence Threshold (`conf`)

**Current**: `0.65` (65%)  
**Default**: `0.25` (25%)

**Purpose**: Filters out low-confidence predictions before NMS.

**Trade-offs**:
- **Higher (0.7-0.8)**: Fewer false positives, may miss some true detections
- **Lower (0.5-0.6)**: Higher recall, more false positives
- **Production sweet spot**: `0.6-0.7`

**When to adjust**:
- False positives → Increase to 0.7-0.75
- Missing true Yellow Boy → Decrease to 0.6
- Borderline detections (faces, leaves) → Keep at 0.65+

**Source**: [Ultralytics Documentation](https://docs.ultralytics.com/modes/predict/)

---

### 2. IoU Threshold (`iou`)

**Current**: `0.6` (60%)  
**Default**: `0.7` (70%)

**Purpose**: Controls Non-Maximum Suppression (NMS) - eliminates overlapping duplicate boxes.

**How it works**:
- Boxes with IoU > threshold are suppressed (only highest-confidence kept)
- Lower IoU = more aggressive NMS = fewer overlapping boxes

**Trade-offs**:
- **Lower (0.5-0.6)**: Removes more duplicates, good for clustered false positives
- **Higher (0.7-0.8)**: Keeps more boxes, useful for dense scenes with multiple objects

**When to adjust**:
- Multiple boxes on same object → Lower to 0.5
- Missing detections in dense Yellow Boy patches → Increase to 0.7

**Source**: [Ultralytics NMS Documentation](https://docs.ultralytics.com/reference/utils/nms/)

---

### 3. Max Detections (`max_det`)

**Current**: `20`  
**Default**: `300`

**Purpose**: Limits maximum number of detections returned per image.

**Rationale**:
- Yellow Boy monitoring expects 1-10 instances per frame
- Limiting to 20 forces model to prioritize highest-confidence detections
- Reduces noise from low-confidence spurious detections

**When to adjust**:
- Dense Yellow Boy scenes (e.g., heavily polluted river) → Increase to 50
- Single-object monitoring (e.g., spot check) → Decrease to 10

---

### 4. Class-Agnostic NMS (`agnostic_nms`)

**Current**: `False`  
**Default**: `False`

**Purpose**: Enables NMS across different classes (irrelevant for single-class models).

**Note**: Yellow Boy is a single-class model, so this parameter has **no effect**. Keep at `False` for standard behavior.

---

## Severity Calculation

```python
# ai/main.py - calculate_severity()
if confidence < 0.5:   return "none"       # Below detection threshold
elif confidence < 0.65: return "mild"      # Low-confidence detection
elif confidence < 0.8: return "moderate"   # Medium confidence
else:                  return "severe"     # High confidence (80%+)
```

**Usage**:
- `"none"`: Not detected or below threshold
- `"mild"`: Detected but low confidence (65-80%)
- `"moderate"`: Confident detection (80-85%)
- `"severe"`: Very confident detection (85%+)

---

## Tuning Workflow

### Phase 1: Conservative (Current Config)
**Goal**: Minimize false positives  
**Settings**: `conf=0.65, iou=0.6, max_det=20`

**Monitor**:
- False positive rate (faces, leaves, rocks incorrectly detected)
- False negative rate (missing true Yellow Boy)

### Phase 2: Aggressive False Positive Reduction
**Goal**: Near-zero false positives (if Phase 1 insufficient)  
**Settings**: `conf=0.7, iou=0.5, max_det=10`

**Trade-off**: Will miss some low-confidence true detections

### Phase 3: Recall Optimization
**Goal**: Catch more true Yellow Boy (if missing too many)  
**Settings**: `conf=0.55, iou=0.7, max_det=50`

**Trade-off**: More false positives

---

## Testing Commands

### Test with Dataset
```bash
cd /Users/macbook/Documents/coding/aquamine

for img in ./ai/dataset/yellow-boy-detection.v2i.yolov8/test/images/*.jpg; do
  echo "Testing: $(basename $img)"
  curl -s -X POST http://localhost:8000/api/v1/cv/analyze \
    -F "file=@${img}" | jq '{detected, confidence, severity, bboxes: (.bboxes | length)}'
done
```

### Test False Positive Cases
```bash
# Download test images
curl -o /tmp/face.jpg "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400"
curl -o /tmp/car.jpg "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400"
curl -o /tmp/building.jpg "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400"

# Test (should all return detected: false)
for img in /tmp/{face,car,building}.jpg; do
  curl -s -X POST http://localhost:8000/api/v1/cv/analyze -F "file=@${img}" | jq '{detected, confidence}'
done
```

---

## Advanced: Post-Processing Filters (Future Enhancement)

If parameter tuning alone is insufficient, implement custom filters:

### Area-Based Filtering
```python
min_area = 500    # pixels
max_area = 100000 # pixels

area = (x2 - x1) * (y2 - y1)
if min_area <= area <= max_area:
    # Keep detection
```

### Aspect Ratio Filtering
```python
min_aspect = 0.3  # width/height
max_aspect = 3.0

aspect = (x2 - x1) / (y2 - y1)
if min_aspect <= aspect <= max_aspect:
    # Keep detection
```

### Color Validation (Yellow/Orange Hue)
```python
import cv2
import numpy as np

roi = img[int(y1):int(y2), int(x1):int(x2)]
hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

lower = np.array([15, 50, 50])   # Yellow-orange
upper = np.array([35, 255, 255])
mask = cv2.inRange(hsv, lower, upper)

yellow_ratio = np.sum(mask > 0) / mask.size
if yellow_ratio > 0.3:  # 30% threshold
    # Keep detection
```

---

## Model Retraining Considerations

If parameters cannot solve false positive issues, consider retraining:

1. **Add negative examples**:
   - Faces (various skin tones, angles)
   - Leaves (orange/red autumn leaves)
   - Rocks (orange/brown sediment)
   - Rust (orange metal surfaces)
   
2. **Balance dataset**:
   - Aim for 20-30% background/negative images
   - Empty label files (0 annotations) for negatives
   
3. **Data augmentation**:
   - Color jitter (brightness, saturation)
   - Rotation, flip, crop
   - Lighting conditions (sunny, cloudy, shadows)

---

## References

1. [Ultralytics YOLOv8 Predict Mode](https://docs.ultralytics.com/modes/predict/)
2. [Finding Optimal Confidence Threshold - Voxel51](https://voxel51.com/blog/finding-the-optimal-confidence-threshold)
3. [YOLOv8 Confidence Thresholding Guide](https://medium.com/@isvidhi/the-most-misunderstood-part-of-yolo-confidence-thresholding-box-decoding-076d57222e59)
4. [Ultralytics NMS Reference](https://docs.ultralytics.com/reference/utils/nms/)

---

**Last Updated**: 2026-01-24  
**Config Version**: Production v1 (Post-Research Optimization)
