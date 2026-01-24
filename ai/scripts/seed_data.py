import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add parent dir to path to import ai modules
sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))

from ai.db.connection import AsyncSessionLocal, engine, Base
from ai.db.models import Sensor, Reading
from ai.data_generator.synthetic import AMDWaterQualityGenerator


async def seed_database():
    print("🌱 Seeding database with synthetic AMD data...")

    async with AsyncSessionLocal() as session:
        # 1. Create Sensor if not exists
        sensor_id = "ESP32_AMD_001"
        result = await session.execute(select(Sensor).where(Sensor.sensor_id == sensor_id))
        sensor = result.scalar_one_or_none()

        if not sensor:
            print(f"Creating new sensor: {sensor_id}")
            sensor = Sensor(
                sensor_id=sensor_id,
                name="Mining Site Alpha (Main)",
                latitude=-6.9175,
                longitude=107.6191,
                is_active=True,
            )
            session.add(sensor)
            await session.commit()
            await session.refresh(sensor)
        else:
            print(f"Sensor {sensor_id} already exists.")

        # 2. Generate Synthetic Data (7 Days)
        # Scenario: Start normal, then drift to warning, then crash to critical
        print("Generating 7 days of realistic physics-based data...")

        # Day 1-3: Normal
        gen_normal = AMDWaterQualityGenerator(
            start_date=datetime.now(timezone.utc) - timedelta(days=7),
            days=3,
            interval_minutes=60,
        )
        df_normal = gen_normal.generate_normal_data()

        # Day 4-5: Warning (Drift down)
        gen_warning = AMDWaterQualityGenerator(
            start_date=datetime.now(timezone.utc) - timedelta(days=4),
            days=2,
            interval_minutes=60,
        )
        df_warning = gen_warning.generate_warning_data()

        # Day 6-7: Critical (Crash)
        gen_critical = AMDWaterQualityGenerator(
            start_date=datetime.now(timezone.utc) - timedelta(days=2),
            days=2,
            interval_minutes=60,
        )
        df_critical = gen_critical.generate_critical_data()

        # Combine
        df_final = pd.concat([df_normal, df_warning, df_critical])

        # 3. Insert into Database
        print(f"Inserting {len(df_final)} readings into TimescaleDB hypertable...")

        readings = []
        for _, row in df_final.iterrows():
            reading = Reading(
                sensor_id=sensor.id,
                timestamp=row["timestamp"],
                ph=float(row["ph"]),
                turbidity=float(row["turbidity"]),
                temperature=float(row["temperature"]),
                battery_voltage=3.7 + random.uniform(-0.1, 0.1),  # Add slight noise
                signal_strength=-65 + random.randint(-5, 5),
            )
            readings.append(reading)

        session.add_all(readings)
        await session.commit()

        print("✅ Database seeding complete!")
        print(f"Total readings: {len(readings)}")
        print("Scenario: Normal (3d) -> Warning (2d) -> Critical (2d)")


if __name__ == "__main__":
    import random

    asyncio.run(seed_database())
