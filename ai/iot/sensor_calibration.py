"""
Sensor calibration module for converting raw ADC values to calibrated units.

Handles common sensor types:
- Turbidity: ADC → NTU conversion
- pH: ADC → pH scale (0-14)
- Temperature: ADC → Celsius

Calibration profiles can be customized per sensor_id for accurate readings.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class SensorCalibration:
    """Handles sensor calibration and unit conversion."""

    # Default calibration profiles
    # These are common sensor characteristics - customize per deployment
    TURBIDITY_PROFILES = {
        "default": {
            "input_min": 0,
            "input_max": 3000,
            "ntu_at_min": 0,
            "ntu_at_max": 100,
            "threshold_raw": 200,
        },
        "TS300B": {
            "input_min": 0,
            "input_max": 1000,
            "ntu_at_min": 0,
            "ntu_at_max": 100,
            "threshold_raw": 200,
        },
        "ESP32_QUADRATIC": {
            "input_min": 0,
            "input_max": 3000,
            "ntu_at_min": 0,
            "ntu_at_max": 100,
            "threshold_raw": 200,
        },
    }

    # Sensor-specific profile mapping
    # Override with actual sensor_id → profile mapping based on hardware
    SENSOR_PROFILES = {
        "Coba_Surya": "ESP32_QUADRATIC",
        "ESP32_AMD_001": "ESP32_QUADRATIC",
    }

    def __init__(self):
        self.profiles = self.TURBIDITY_PROFILES

    def calibrate_turbidity(
        self, raw_value: Optional[float], sensor_id: str = ""
    ) -> Optional[float]:
        """
        Convert raw ADC value to calibrated NTU.

        Args:
            raw_value: Raw ADC reading from sensor
            sensor_id: Sensor identifier for profile selection

        Returns:
            Calibrated NTU value, or None if input is None
        """
        if raw_value is None:
            return None

        profile_name = self.SENSOR_PROFILES.get(sensor_id, "default")
        profile = self.profiles.get(profile_name, self.profiles["default"])

        if 0 <= raw_value <= profile["threshold_raw"]:
            return raw_value

        input_min = profile["input_min"]
        input_max = profile["input_max"]
        ntu_min = profile["ntu_at_min"]
        ntu_max = profile["ntu_at_max"]

        clamped_input = max(input_min, min(input_max, raw_value))

        input_range = input_max - input_min
        ntu_range = ntu_max - ntu_min

        if input_range == 0:
            logger.warning("Invalid calibration profile: input_range is zero")
            return 0.0

        calibrated_ntu = ntu_min + (clamped_input - input_min) * ntu_range / input_range

        calibrated_ntu = max(0.0, calibrated_ntu)

        logger.debug(
            f"Turbidity calibration [{sensor_id}:{profile_name}]: "
            f"ADC {raw_value:.1f} → {calibrated_ntu:.1f} NTU"
        )

        return round(calibrated_ntu, 2)

    def calibrate_readings(
        self, readings: Dict[str, Optional[float]], sensor_id: str = ""
    ) -> Dict[str, Optional[float]]:
        """
        Calibrate all sensor readings in a payload.

        Args:
            readings: Dict with keys like 'ph', 'turbidity', 'temperature'
            sensor_id: Sensor identifier

        Returns:
            Calibrated readings dict
        """
        calibrated = readings.copy()

        # Calibrate turbidity if present
        if "turbidity" in calibrated and calibrated["turbidity"] is not None:
            original = calibrated["turbidity"]
            calibrated["turbidity"] = self.calibrate_turbidity(original, sensor_id)

            # Log if significant correction was made
            if original != calibrated["turbidity"]:
                logger.info(
                    f"Applied turbidity calibration for {sensor_id}: "
                    f"{original:.1f} → {calibrated['turbidity']:.1f} NTU"
                )

        # TODO: Add pH and temperature calibration if needed
        # For now, assume pH and temperature are already calibrated by sensor firmware

        return calibrated


# Singleton instance
sensor_calibration = SensorCalibration()
