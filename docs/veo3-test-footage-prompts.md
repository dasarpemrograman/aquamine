# Google Veo 3 Prompts - Yellow Boy Test Footage Generation

## Purpose
Generate realistic test footage for Yellow Boy (acid mine drainage) detection system using Google Veo 3 video AI generator. These videos simulate various real-world scenarios for testing the CV detection pipeline.

---

## Prompt 1: Mild Yellow Boy - Clear Daylight Stream

A cinematic aerial drone shot slowly descending towards a small mountain stream flowing through rocky terrain in bright midday sunlight. The water is mostly clear and transparent, but contains subtle patches of pale yellowish-orange sediment floating on the surface, creating thin films and small clusters near the stream edges where the current is slower. The camera pans smoothly from left to right following the water flow downstream, capturing reflections of blue sky and surrounding pine trees on the water surface. Small ripples and gentle water movement create natural motion. The yellow boy precipitates are barely visible, appearing as faint orange-yellow streaks and small concentrated spots, approximately 10-15% coverage of the visible water surface. Natural ambient sound of flowing water. Duration 10 seconds. Photorealistic, 4K quality, natural color grading with slightly enhanced contrast to make the subtle yellow tones visible against the clear water.

**Expected Detection**: detected=true, severity="mild", confidence=0.65-0.75

---

## Prompt 2: Moderate Yellow Boy - Overcast Mining Area

A handheld POV camera perspective walking along the bank of a sluggish stream near an old mining site on an overcast afternoon. The water appears murky with moderate contamination, showing distinct patches of bright orange-yellow precipitate covering approximately 40-50% of the water surface. The yellow boy forms thicker films and foam-like clusters, particularly accumulated in slower-moving areas near rocks and along the shoreline. Camera slowly pans left to right with slight natural hand shake, focusing on a section where the orange sediment is clearly visible against darker water. Weathered rocks and dead vegetation visible on the banks. Muted natural lighting with soft shadows. The contamination creates an unnatural rust-orange color that contrasts sharply with the surrounding natural gray-brown stream bed. Duration 10 seconds. Realistic documentary style, slightly desaturated color palette with emphasis on the stark orange-yellow pollution, 4K resolution.

**Expected Detection**: detected=true, severity="moderate", confidence=0.75-0.85

---

## Prompt 3: Severe Yellow Boy - Heavy AMD Contamination

A static wide-angle shot from a fixed camera position overlooking a heavily polluted drainage channel flowing from an abandoned mine tailings area. The entire water surface is densely covered with thick, vivid orange-yellow precipitate forming a continuous layer that resembles rust-colored paint. The yellow boy creates foam, bubbles, and crusty deposits along the concrete channel edges, with some areas showing dried orange residue on the banks. Slow water movement beneath the contamination layer, barely visible through the thick precipitate. The pollution is so severe that almost no clear water is visible, with 80-90% coverage of bright orange-yellow sediment. Industrial wasteland background with gray sky and dead vegetation. Camera remains perfectly still throughout. Duration 10 seconds. High-contrast, sharp detail capturing the texture of the precipitate, documentary evidence style, 4K resolution with enhanced color saturation to emphasize the environmental damage.

**Expected Detection**: detected=true, severity="severe", confidence=0.90-0.95

---

## Prompt 4: Clean Water - Negative Control

A smooth tracking shot following a pristine mountain creek flowing through a lush forest landscape on a sunny morning. Crystal clear water rushes over smooth river rocks and small cascades, creating white foam and natural turbulence. Sunlight filters through the tree canopy creating dappled light patterns on the water surface. The water is completely transparent, revealing smooth stones and pebbles on the creek bed underneath. Natural green and brown tones from surrounding vegetation reflect on the water surface. Small aquatic plants visible underwater. Camera moves steadily upstream, capturing the pure, uncontaminated water with no discoloration, no sediment, and no artificial contamination. Natural forest sounds of water rushing and birds chirping. Duration 10 seconds. Vibrant natural colors, high dynamic range, crystal-clear detail, nature documentary cinematography, 4K resolution.

**Expected Detection**: detected=false, confidence=0.0

---

## Prompt 5: False Positive Challenge - Autumn Leaves

A serene top-down shot of a calm pond in early autumn, captured by a drone hovering steadily at medium altitude. The water surface is partially covered with floating fallen leaves in various shades of orange, red, yellow, and brown, creating a natural colorful pattern. The leaves cluster in some areas due to gentle wind, while other sections show clear dark water reflecting the gray-blue sky. Some leaves are bright orange and yellow, similar in hue to yellow boy precipitate, but clearly identifiable as organic matter with visible leaf shapes, stems, and natural textures. The leaves drift slowly across the frame from right to left with gentle water movement. Soft overcast lighting with no harsh shadows. Shore vegetation visible at the edges of the frame. Duration 10 seconds. Natural autumnal color palette, soft focus on background with sharp detail on leaves, 4K cinematic quality with slight color grading to enhance the golden-hour aesthetic.

**Expected Detection**: detected=false (post-optimization), confidence=0.3-0.5 (should be filtered by 0.65 threshold)

---

## Video Specifications

**Format**: MP4 (H.264 codec)  
**Resolution**: 4K (3840x2160) or 1080p (1920x1080)  
**Frame Rate**: 24fps or 30fps  
**Duration**: 10 seconds each  
**Aspect Ratio**: 16:9 (landscape)

---

## Post-Generation Testing Workflow

1. **Download videos** from Google Veo 3
2. **Upload to dashboard** at `http://localhost:3000/cv`
3. **Test in Video File mode**:
   - Load video → Play → Start Inference
   - Observe detection results at ~1 FPS
4. **Verify expected outcomes**:
   - Prompt 1: Mild detection (yellow, 65-75% conf)
   - Prompt 2: Moderate detection (orange, 75-85% conf)
   - Prompt 3: Severe detection (red, 90%+ conf)
   - Prompt 4: No detection (clean water)
   - Prompt 5: No detection (false positive filtered)

---

## Notes

- **Color accuracy**: Ensure yellow-orange hues match real Yellow Boy spectral signature (HSV: 15-35° hue)
- **Texture details**: Include foam, sediment clusters, and surface films characteristic of AMD
- **Lighting variation**: Test different lighting conditions (bright, overcast, shadows)
- **Motion**: Vary camera movement (static, pan, tracking, aerial) to test detection stability
- **Duration**: 10 seconds provides ~10 inference samples at 1 FPS

---

**Generated**: 2026-01-24  
**Purpose**: CV System Test Footage for YOLOv8 Yellow Boy Detection
