#!/usr/bin/env python3
"""
Test script for turbidity calibration.
Shows before/after values to verify the conversion is working.
"""

import sys

sys.path.insert(0, "ai")

from ai.iot.sensor_calibration import sensor_calibration

test_cases = [
    ("Clear water (0 NTU)", 0),
    ("Low turbidity (50 NTU)", 50),
    ("Boundary (100 NTU)", 100),
    ("Raw ADC - muddy (2900)", 2900),
    ("Raw ADC - mid (2600)", 2600),
    ("Raw ADC - clearing (2300)", 2300),
    ("Raw ADC - max (4095)", 4095),
]

print("=" * 70)
print("TURBIDITY CALIBRATION TEST")
print("=" * 70)
print(f"{'Description':<30} {'Raw Input':<15} {'Calibrated (NTU)':<20}")
print("-" * 70)

for description, raw_value in test_cases:
    calibrated = sensor_calibration.calibrate_turbidity(raw_value, "Coba_Surya")
    print(f"{description:<30} {raw_value:<15.1f} {calibrated:<20.2f}")

print("=" * 70)
print("\nFormula: Linear mapping from ADC (0-4095) to NTU (3000-0)")
print("Result: Values > 1000 are treated as raw ADC and converted.")
print("        Values 0-100 are assumed already calibrated and passed through.")
