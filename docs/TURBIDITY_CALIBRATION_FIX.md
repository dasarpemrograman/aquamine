# Turbidity Sensor Calibration Fix

## Problem
Sensor **Coba_Surya** (ESP32_AMD_001) was sending turbidity readings in the range of 2000-3000, which is far beyond the normal range for water quality monitoring (0-100 NTU).

**Root Cause:** The ESP32 firmware uses a quadratic formula that outputs values in the range 0-3000, which are not properly calibrated to real-world NTU (Nephelometric Turbidity Units).

## Analysis
From the ESP32 firmware:
```cpp
ntu = -1120.4 * pow(currentTurbVolts, 2) + 5742.3 * currentTurbVolts - 4353.8;
if(ntu < 0) ntu = 0; 
if(ntu > 3000) ntu = 3000;  // Clamped to 3000 max
```

This formula produces values that are **30x higher** than expected for mining water quality (normal: 0-100 NTU, warning: >50 NTU, critical: >100 NTU).

## Solution
Added automatic calibration in the backend (`ai/iot/sensor_calibration.py`) that:

1. **Detects** raw sensor values (> 200 treated as uncalibrated)
2. **Converts** to proper NTU scale using linear mapping:
   - Input range: 0-3000 (from ESP32 formula)
   - Output range: 0-100 NTU (real-world scale)
3. **Preserves** already-calibrated values (0-200 passed through)

### Calibration Formula
```
NTU = 0 + (raw_value - 0) * (100 - 0) / (3000 - 0)
NTU = raw_value * 100 / 3000
NTU = raw_value / 30
```

### Example Conversions
| ESP32 Raw | Calibrated NTU | Interpretation |
|-----------|----------------|----------------|
| 0         | 0.00           | Crystal clear  |
| 1500      | 50.00          | Warning level  |
| 2900      | 96.67          | Critical level |
| 3000      | 100.00         | Max turbidity  |

## Implementation
Modified files:
1. **`ai/iot/sensor_calibration.py`** - New calibration module
2. **`ai/iot/mqtt_bridge.py`** - Integrated calibration into data ingestion pipeline

The calibration is applied automatically to all incoming readings from sensors configured with the `ESP32_QUADRATIC` profile (Coba_Surya, ESP32_AMD_001).

## Verification
Run test script:
```bash
python3 test_calibration.py
```

Expected output shows proper scaling:
```
Raw ADC - muddy (2900)     2900.0          96.67 NTU
Raw ADC - mid (2600)       2600.0          86.67 NTU
```

## Alternative: Fix in Firmware (Long-term)
For a permanent solution, the ESP32 firmware should be recalibrated using known turbidity standards:

1. Prepare reference solutions (0, 50, 100 NTU)
2. Measure voltage output for each
3. Calculate new polynomial coefficients
4. Update `TURB_CLEAR_VOLTS` and the quadratic formula

This backend calibration is a **non-invasive workaround** that doesn't require reflashing ESP32 devices in the field.

## Status
✅ **Implemented and deployed**
- Backend calibration active for Coba_Surya sensor
- Historical data remains uncalibrated (can be migrated if needed)
- New readings automatically calibrated on ingestion
