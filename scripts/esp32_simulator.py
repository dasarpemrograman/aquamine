from __future__ import annotations

import argparse
import asyncio
import math
import os
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import httpx
from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR))

from ai.db.connection import AsyncSessionLocal
from ai.db.models import Reading, Sensor, SensorAlertState
from ai.anomaly.detector import ANOMALY_THRESHOLDS


def _determine_state_from_reading(ph: float, turbidity: float) -> str:
    """Determine alert state based on reading values using same thresholds as anomaly detector."""
    if ph < ANOMALY_THRESHOLDS["ph"]["critical_low"]:
        return "critical"
    if turbidity > ANOMALY_THRESHOLDS["turbidity"]["critical_high"]:
        return "critical"
    if ph < ANOMALY_THRESHOLDS["ph"]["warning_low"]:
        return "warning"
    if turbidity > ANOMALY_THRESHOLDS["turbidity"]["warning_high"]:
        return "warning"
    return "normal"


DEFAULT_SENSOR_ID = "ESP32_SIM_001"
DEFAULT_SENSOR_NAME = "Mining Site Beta (Simulator)"
DEFAULT_LATITUDE = 46.016743
DEFAULT_LONGITUDE = -112.522680
DEFAULT_API_BASE = os.getenv("API_BASE_URL", "http://localhost:8181")
INGEST_API_KEY = os.getenv("INGEST_API_KEY", "")


@dataclass(frozen=True)
class SimulatorReading:
    timestamp: datetime
    ph: float
    turbidity: float
    temperature: float
    battery_voltage: float
    signal_strength: int


async def _send_reading_http(
    client: httpx.AsyncClient,
    api_base: str,
    sensor_id: str,
    reading: SimulatorReading,
    ingest_key: str = "",
) -> bool:
    url = f"{api_base}/api/v1/sensors/ingest"
    payload = {
        "sensor_id": sensor_id,
        "timestamp": reading.timestamp.isoformat(),
        "location": {"lat": DEFAULT_LATITUDE, "lon": DEFAULT_LONGITUDE},
        "readings": {
            "ph": reading.ph,
            "turbidity": reading.turbidity,
            "temperature": reading.temperature,
        },
        "metadata": {
            "battery_voltage": reading.battery_voltage,
            "signal_strength": reading.signal_strength,
        },
    }
    headers = {}
    if ingest_key:
        headers["X-Ingest-Key"] = ingest_key
    try:
        resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
        resp.raise_for_status()
        return True
    except httpx.HTTPError as e:
        print(f"HTTP Error sending reading: {e}")
        return False


def _choose_severity(scenario: str) -> str:
    if scenario != "auto":
        return scenario
    roll = random.random()
    if roll < 0.01:
        return "critical"
    if roll < 0.1:
        return "warning"
    return "normal"


def _generate_ph(severity: str) -> float:
    if severity == "critical":
        return round(random.uniform(4.1, 4.9), 2)
    if severity == "warning":
        return round(random.uniform(5.0, 6.4), 2)
    return round(random.uniform(6.5, 7.5), 2)


def _generate_turbidity(severity: str) -> float:
    if severity == "critical":
        return round(random.uniform(150.0, 220.0), 1)
    if severity == "warning":
        return round(random.uniform(80.0, 150.0), 1)
    return round(random.uniform(20.0, 80.0), 1)


def _generate_temperature(timestamp: datetime) -> float:
    hour = timestamp.astimezone(timezone.utc).hour + timestamp.minute / 60
    base = 27.0
    amplitude = 3.0
    diurnal = amplitude * math.sin(2 * math.pi * (hour - 6) / 24)
    noise = random.uniform(-0.4, 0.4)
    temp = base + diurnal + noise
    return round(min(max(temp, 24.0), 30.0), 2)


def _generate_battery_voltage() -> float:
    return round(3.7 + random.uniform(-0.08, 0.08), 2)


def _generate_signal_strength() -> int:
    return int(-65 + random.randint(-6, 4))


def _build_reading(timestamp: datetime, scenario: str) -> SimulatorReading:
    severity = _choose_severity(scenario)
    return SimulatorReading(
        timestamp=timestamp,
        ph=_generate_ph(severity),
        turbidity=_generate_turbidity(severity),
        temperature=_generate_temperature(timestamp),
        battery_voltage=_generate_battery_voltage(),
        signal_strength=_generate_signal_strength(),
    )


async def _update_alert_state(session, sensor_id: int, new_state: str) -> None:
    state_result = await session.execute(
        select(SensorAlertState).where(SensorAlertState.sensor_id == sensor_id)
    )
    alert_state = state_result.scalar_one_or_none()
    if alert_state:
        alert_state.current_state = new_state
    else:
        alert_state = SensorAlertState(sensor_id=sensor_id, current_state=new_state)
        session.add(alert_state)
    await session.commit()


async def _ensure_alert_state(session, sensor_id: int) -> None:
    state_result = await session.execute(
        select(SensorAlertState).where(SensorAlertState.sensor_id == sensor_id)
    )
    if not state_result.scalar_one_or_none():
        alert_state = SensorAlertState(sensor_id=sensor_id, current_state="normal")
        session.add(alert_state)
        await session.commit()


async def _ensure_sensor(session, sensor_id: str) -> Sensor:
    result = await session.execute(select(Sensor).where(Sensor.sensor_id == sensor_id))
    sensor = result.scalar_one_or_none()
    if sensor:
        await _ensure_alert_state(session, sensor.id)
        return sensor

    sensor = Sensor(
        sensor_id=sensor_id,
        name=DEFAULT_SENSOR_NAME,
        latitude=DEFAULT_LATITUDE,
        longitude=DEFAULT_LONGITUDE,
        is_active=True,
    )
    session.add(sensor)
    await session.commit()
    await session.refresh(sensor)

    await _ensure_alert_state(session, sensor.id)

    return sensor


async def _insert_readings(sensor_id: int, readings: Iterable[SimulatorReading]) -> int:
    async with AsyncSessionLocal() as session:
        db_readings = [
            Reading(
                sensor_id=sensor_id,
                timestamp=reading.timestamp,
                ph=reading.ph,
                turbidity=reading.turbidity,
                temperature=reading.temperature,
                battery_voltage=reading.battery_voltage,
                signal_strength=reading.signal_strength,
            )
            for reading in readings
        ]
        session.add_all(db_readings)
        await session.commit()
        return len(db_readings)


async def run_backfill(args: argparse.Namespace) -> None:
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=args.days)
    total_points = int((args.days * 24 * 60) / args.interval_minutes)
    timestamps = [
        start_time + timedelta(minutes=i * args.interval_minutes)
        for i in range(total_points)
    ]

    readings = [_build_reading(ts, args.scenario) for ts in timestamps]

    if args.db_direct:
        print(f"Starting DB-DIRECT backfill for {args.sensor_id}...")
        async with AsyncSessionLocal() as session:
            sensor = await _ensure_sensor(session, args.sensor_id)

        inserted = await _insert_readings(sensor.id, readings)

        if readings:
            last_reading = readings[-1]
            final_state = _determine_state_from_reading(
                last_reading.ph, last_reading.turbidity
            )
            async with AsyncSessionLocal() as session:
                await _update_alert_state(session, sensor.id, final_state)

        print(
            f"Inserted {inserted} readings for {args.sensor_id} "
            f"from {start_time.isoformat()} to {end_time.isoformat()}"
        )
    else:
        print(f"Starting HTTP backfill for {args.sensor_id} to {args.api_base}...")
        success_count = 0
        async with httpx.AsyncClient() as client:
            for i, reading in enumerate(readings):
                if await _send_reading_http(
                    client, args.api_base, args.sensor_id, reading, args.ingest_key
                ):
                    success_count += 1
                if (i + 1) % 10 == 0:
                    print(f"Sent {i + 1}/{len(readings)} readings...")

        print(
            f"Successfully sent {success_count}/{len(readings)} readings for {args.sensor_id} "
            f"from {start_time.isoformat()} to {end_time.isoformat()}"
        )


async def run_realtime(args: argparse.Namespace) -> None:
    if args.db_direct:
        print(f"Starting DB-DIRECT realtime simulation for {args.sensor_id}...")
        async with AsyncSessionLocal() as session:
            sensor = await _ensure_sensor(session, args.sensor_id)

            count = 0
            while True:
                timestamp = datetime.now(timezone.utc)
                reading = _build_reading(timestamp, args.scenario)
                session.add(
                    Reading(
                        sensor_id=sensor.id,
                        timestamp=reading.timestamp,
                        ph=reading.ph,
                        turbidity=reading.turbidity,
                        temperature=reading.temperature,
                        battery_voltage=reading.battery_voltage,
                        signal_strength=reading.signal_strength,
                    )
                )
                await session.commit()

                new_state = _determine_state_from_reading(reading.ph, reading.turbidity)
                await _update_alert_state(session, sensor.id, new_state)

                count += 1
                print(
                    f"Sent reading #{count} at {timestamp.isoformat()} "
                    f"pH={reading.ph} turbidity={reading.turbidity} state={new_state}"
                )

                if args.count and count >= args.count:
                    break
                await asyncio.sleep(args.interval)
    else:
        print(
            f"Starting HTTP realtime simulation for {args.sensor_id} to {args.api_base}..."
        )
        async with httpx.AsyncClient() as client:
            count = 0
            while True:
                timestamp = datetime.now(timezone.utc)
                reading = _build_reading(timestamp, args.scenario)

                success = await _send_reading_http(
                    client, args.api_base, args.sensor_id, reading, args.ingest_key
                )

                count += 1
                status = "SENT" if success else "FAIL"
                state = _determine_state_from_reading(reading.ph, reading.turbidity)
                print(
                    f"[{status}] Reading #{count} at {timestamp.isoformat()} "
                    f"pH={reading.ph} turbidity={reading.turbidity} local_state={state}"
                )

                if args.count and count >= args.count:
                    break
                await asyncio.sleep(args.interval)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ESP32 sensor simulator")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--backfill", action="store_true", help="Backfill historical data"
    )
    mode.add_argument(
        "--realtime", action="store_true", help="Stream data continuously"
    )

    parser.add_argument(
        "--sensor-id", default=DEFAULT_SENSOR_ID, help="Sensor identifier"
    )
    parser.add_argument(
        "--days", type=int, default=7, help="Days of history to generate"
    )
    parser.add_argument(
        "--interval-minutes", type=int, default=60, help="Backfill interval in minutes"
    )
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="API Base URL")
    parser.add_argument(
        "--ingest-key",
        default=INGEST_API_KEY,
        help="API ingest key for X-Ingest-Key header (defaults to INGEST_API_KEY env var)",
    )
    parser.add_argument(
        "--db-direct",
        action="store_true",
        help="Write directly to DB (bypasses API, debug only)",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Realtime interval in seconds (default 5 minutes)",
    )
    parser.add_argument(
        "--scenario",
        choices=["auto", "normal", "warning", "critical"],
        default="auto",
        help="Force a scenario or use auto mix",
    )
    parser.add_argument("--count", type=int, help="Stop after N realtime readings")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    if args.backfill:
        asyncio.run(run_backfill(args))
    else:
        asyncio.run(run_realtime(args))


if __name__ == "__main__":
    main()
