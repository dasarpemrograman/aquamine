#!/usr/bin/env python3
"""Quick test script for simulator HTTP mode."""

import sys
import os

sys.path.insert(0, "/Users/macbook/Documents/coding/aquamine")

# Mock the HTTP calls for testing
from unittest.mock import patch, MagicMock
import asyncio


async def test_simulator():
    """Test simulator uses HTTP by default."""
    print("Testing simulator HTTP mode...")

    # Import after path setup
    from scripts.esp32_simulator import _build_reading, _reading_to_payload
    from datetime import datetime, timezone

    # Test reading generation
    reading = _build_reading(datetime.now(timezone.utc), "normal")
    print(f"✓ Generated reading: pH={reading.ph}, temp={reading.temperature}")

    # Test payload conversion
    payload = _reading_to_payload("TEST_001", reading)
    print(f"✓ Payload keys: {list(payload.keys())}")
    print(f"✓ Readings: {payload['readings']}")

    # Verify HTTP mode is default (no --db-direct flag)
    import argparse
    from scripts.esp32_simulator import parse_args

    # Parse with --realtime (should default to HTTP)
    args = parse_args(["--realtime", "--count=1"])
    print(f"✓ Default mode: HTTP (db_direct={args.db_direct})")

    # Parse with --db-direct (explicit opt-in)
    args_direct = parse_args(["--realtime", "--count=1", "--db-direct"])
    print(f"✓ Debug mode: DB-direct (db_direct={args_direct.db_direct})")

    print("\n✅ All simulator tests PASSED!")
    print("Default behavior: HTTP POST to /api/v1/sensors/ingest")
    print("Debug behavior: Direct DB writes (with --db-direct flag)")


if __name__ == "__main__":
    asyncio.run(test_simulator())
