# CV Yellow Boy Detection - Test Results

## Model Information

| Property | Value |
|----------|-------|
| Architecture | YOLOv8n (nano) |
| Training Images | ~150 (112 original + augmentation) |
| Classes | `yellow_boy` |
| Input Size | 512x512 |
| Training Platform | Google Colab (T4 GPU) |
| Epochs | 89 (early stopped at patience=30) |

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Precision | ~0.80 | When it detects, usually correct |
| Recall | ~0.35 | Misses some instances (low-res images) |
| mAP50 | ~0.38 | Moderate - acceptable for hackathon |
| mAP50-95 | ~0.25 | Strict IoU threshold |

## Test Results Summary

### Positive Cases (Yellow Boy Images)
- **High-res, clear contamination**: ✓ Detected with good confidence
- **Medium-res, partial contamination**: ✓ Detected
- **Low-res images**: ⚠️ Often missed (false negative)
- **Multiple patches in single image**: ✓ Multiple bboxes returned

### Negative Cases (Clean Water / Non-Yellow Boy)
- **Clear blue water**: ✓ No detection (correct)
- **Muddy brown water**: ✓ No detection (correct)
- **Yellow autumn leaves**: ✓ No detection (correct)

## Known Limitations

1. **Low recall on low-resolution images** - Model trained on 512x512, struggles with smaller images
2. **Dataset size** - Only ~150 images, more data would improve recall
3. **Object detection vs segmentation** - Bounding boxes include some background; segmentation would be more precise

## Recommendations for Improvement

1. **Add more training data** - Target 500+ images for production
2. **Include more negative examples** - Reduce false positives further
3. **Consider instance segmentation** - For precise boundary detection
4. **Augmentation** - Enable flip, rotation, brightness in Roboflow

## API Endpoint

```bash
# Test command
curl -X POST http://localhost:8000/api/v1/cv/analyze \
  -F "file=@yellow_boy_image.jpg" | jq

# Expected response
{
  "detected": true,
  "confidence": 0.75,
  "severity": "severe",
  "bbox": {
    "x": 120,
    "y": 80,
    "width": 200,
    "height": 150,
    "confidence": 0.75
  },
  "bboxes": [...],
  "latency_ms": 45,
  "model_version": "yolov8n-yellowboy-v1",
  "image_width": 640,
  "image_height": 480,
  "warnings": []
}
```

## Verification Commands

```bash
# Run backend tests
cd ai && uv run pytest tests/ -v

# Start backend
cd ai && uv run uvicorn main:app --reload

# Start frontend
cd dashboard && npm run dev

# Open browser
open http://localhost:3000/cv
```

## Date

Test completed: January 23, 2026
