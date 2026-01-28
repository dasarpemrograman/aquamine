#!/usr/bin/env python3
"""Initialize database tables and seed data."""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db.connection import engine, Base
from db.models import (
    Sensor,
    Reading,
    Prediction,
    Anomaly,
    Alert,
    NotificationRecipient,
    UserSettings,
    SensorAlertState,
)

_ = (
    Sensor,
    Reading,
    Prediction,
    Anomaly,
    Alert,
    NotificationRecipient,
    UserSettings,
    SensorAlertState,
)


async def init_db():
    """Create all tables and seed initial data."""
    print("Creating database tables...")

    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    print("✓ Tables created successfully")

    # Seed notification recipients
    print("Seeding notification recipients...")
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select

    async with AsyncSession(engine) as session:
        # Check if recipients already exist
        result = await session.execute(select(NotificationRecipient))
        existing = result.scalars().first()

        if not existing:
            # Add default recipient (you can customize this)
            recipient = NotificationRecipient(
                name="Admin",
                phone="6281234567890",  # Replace with your WhatsApp number
                email="admin@aquamine.local",  # Replace with your email
                is_active=True,
                notify_warning=True,
                notify_critical=True,
            )
            session.add(recipient)
            await session.commit()
            print("✓ Default notification recipient added")
        else:
            print("✓ Notification recipients already exist")

    print("\n✅ Database initialization complete!")
    print("\nNext steps:")
    print("1. Start the API: docker compose up api")
    print("2. Generate test data: docker compose exec api python -m data_generator.synthetic")
    print("3. Open dashboard: http://localhost:3000")


if __name__ == "__main__":
    asyncio.run(init_db())
