# Dataset Collection Guide for Yellow Boy Detection

This guide covers collecting and labeling images for training a YOLOv8 model to detect "Yellow Boy" (iron hydroxide precipitate) in water bodies.

## What is Yellow Boy?

Yellow Boy is an orange-yellow precipitate formed when iron hydroxide deposits in water affected by Acid Mine Drainage (AMD). It appears when dissolved iron oxidizes and precipitates as ferric hydroxide (Fe(OH)3), creating distinctive discoloration in streams, ponds, and drainage channels near mining sites.

### RGB Signature

Yellow Boy has a documented color signature:
- **Red:** 180-220 (high)
- **Green:** 140-180 (medium)
- **Blue:** 60-120 (low)

Spectral bands 570-610 nm correlate with AMD severity. The ratio of band 665/560 nm is a characteristic indicator.

### What IS Yellow Boy

- Orange-yellow iron hydroxide precipitate on water surface
- Iron oxide deposits coating rocks and sediment in streams
- AMD-caused discoloration in settling ponds and drainage channels
- Ferric hydroxide staining on stream beds
- Ochre-colored mineral deposits at mine drainage outlets

### What is NOT Yellow Boy

- Autumn leaves floating on water or on stream banks
- Natural sand, clay, or sediment (brown/tan colors)
- Green or brown algae blooms
- Light reflections or sun glare on water
- Rust on man-made structures (pipes, bridges, equipment)
- Pollen on water surface
- Mud or turbid water from erosion

## Search Queries for Image Collection

Use these queries on Google Images, Flickr, or academic image databases:

1. `"acid mine drainage" yellow`
2. `"iron hydroxide" water`
3. `"yellow boy" mining`
4. `AMD precipitate`
5. `"mine drainage" orange`
6. `iron oxide stream contamination`
7. `ferric hydroxide mine water`
8. `acid mine runoff discoloration`

### Additional Sources

- USGS photo archives (search "acid mine drainage")
- EPA Superfund site documentation
- Mining remediation project reports
- Academic papers on AMD (check figures)
- State environmental agency photo libraries

## Roboflow Project Setup (Free Tier)

1. **Create Account**
   - Go to [roboflow.com](https://roboflow.com)
   - Sign up for a free account (allows 10,000 images, 3 projects)

2. **Create New Project**
   - Click "Create New Project"
   - Project Name: `yellow-boy-detection`
   - Project Type: **Object Detection**
   - Annotation Group: `yellow_boy`
   - License: Choose based on your needs (Private for hackathon)

3. **Upload Images**
   - Drag and drop images into the upload area
   - Roboflow auto-detects duplicates
   - Aim for 200-500 images minimum for initial training

4. **Annotate Images**
   - Use the built-in annotation tool
   - Draw bounding boxes around Yellow Boy patches
   - Use class name: `yellow_boy`

5. **Generate Dataset Version**
   - Apply preprocessing: Auto-Orient, Resize (640x640)
   - Apply augmentations: Flip (horizontal), Rotate (+/-15 degrees), Brightness (+/-15%)
   - Generate version

## Labeling Rules

### Bounding Box Guidelines

- **Annotation type:** Bounding boxes only (not segmentation masks)
- **Minimum size:** 20x20 pixels (smaller patches are hard to detect reliably)
- **Label each patch separately:** Don't group multiple distinct patches into one box
- **Tight boxes:** Keep boxes close to the Yellow Boy boundary, avoid excess background
- **Partial visibility:** If Yellow Boy is partially visible at image edge, annotate the visible portion

### Class Name

Use a single class: `yellow_boy`

### Edge Cases

| Scenario | Action |
|----------|--------|
| Very small patch (<20px) | Skip annotation |
| Blurry or unclear | Skip annotation |
| Mixed with algae | Annotate only the clearly yellow/orange portions |
| Reflections obscuring | Skip if uncertain |
| Multiple patches | Draw separate boxes for each |

## Negative Examples

Include 20-30 images that do NOT contain Yellow Boy. These help the model learn what to ignore.

Good negative examples:
- Clean streams and water bodies
- Autumn scenes with orange/yellow leaves near water
- Sandy or muddy river banks
- Algae-covered ponds
- Rusty structures near water (not AMD)
- Normal mine sites without AMD visible

Label these images with no annotations (empty annotation files).

## Export Format

Export from Roboflow in **YOLOv8** format:

1. Go to your dataset version
2. Click "Export Dataset"
3. Select Format: **YOLOv8**
4. Choose "download zip" or "show download code"

### YOLOv8 Format Structure

```
dataset/
  train/
    images/
      img001.jpg
      img002.jpg
    labels/
      img001.txt
      img002.txt
  valid/
    images/
    labels/
  test/
    images/
    labels/
  data.yaml
```

Each `.txt` file contains annotations in format:
```
<class_id> <x_center> <y_center> <width> <height>
```

Values are normalized (0-1). For single-class detection, `class_id` is always `0`.

## Recommended Split

| Split | Percentage | Purpose |
|-------|------------|---------|
| Train | 70% | Model training |
| Validation | 20% | Hyperparameter tuning, early stopping |
| Test | 10% | Final evaluation (never seen during training) |

Roboflow applies this split automatically during version generation. Ensure images are randomly distributed (not grouped by source).

## Quality Checklist

Before finalizing your dataset, verify:

### Image Quality
- [ ] Resolution at least 640x640 (or scalable)
- [ ] No heavily pixelated or corrupted images
- [ ] Variety of lighting conditions (sunny, overcast, shadows)
- [ ] Mix of close-up and wide-angle shots
- [ ] Different water body types (streams, ponds, drainage)

### Annotation Quality
- [ ] All Yellow Boy patches annotated (no missed instances)
- [ ] Boxes are tight (not excessively large)
- [ ] No duplicate annotations on same patch
- [ ] Consistent class name used (`yellow_boy`)
- [ ] Minimum 20x20px box size enforced

### Dataset Balance
- [ ] At least 200 positive images (with Yellow Boy)
- [ ] 20-30 negative images (no Yellow Boy)
- [ ] Images from multiple sources/locations
- [ ] Variety of Yellow Boy severity levels

### Export Verification
- [ ] Export format is YOLOv8 (txt annotations)
- [ ] `data.yaml` contains correct paths and class names
- [ ] Train/val/test splits are correct (70/20/10)
- [ ] Downloaded zip extracts correctly

## Quick Start Checklist

1. [ ] Create Roboflow account and project
2. [ ] Collect 50+ images using search queries above
3. [ ] Upload to Roboflow
4. [ ] Annotate all Yellow Boy patches (bounding boxes)
5. [ ] Add 20-30 negative examples
6. [ ] Generate dataset version with augmentations
7. [ ] Export in YOLOv8 format
8. [ ] Verify export with quality checklist
