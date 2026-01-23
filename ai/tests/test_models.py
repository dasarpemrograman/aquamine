import pytest
from datetime import datetime, timezone


class TestDatabaseModels:
    def test_sensor_model_creation(self, db_session):
        from db.models import Sensor

        sensor = Sensor(
            sensor_id="ESP32_TEST_001", name="Test Sensor 1", latitude=-6.9175, longitude=107.6191
        )
        db_session.add(sensor)
        db_session.commit()

        assert sensor.id is not None
        assert sensor.is_active is True
        assert sensor.created_at is not None

    def test_reading_model_creation(self, db_session):
        from db.models import Sensor, Reading

        sensor = Sensor(sensor_id="ESP32_TEST_002", name="Test Sensor 2")
        db_session.add(sensor)
        db_session.commit()

        reading = Reading(
            sensor_id=sensor.id,
            timestamp=datetime.now(timezone.utc),
            ph=6.8,
            turbidity=25.5,
            temperature=28.0,
        )
        db_session.add(reading)
        db_session.commit()

        assert reading.id is not None
        assert reading.ph == 6.8

    def test_alert_model_creation(self, db_session):
        from db.models import Sensor, Alert

        sensor = Sensor(sensor_id="ESP32_TEST_003", name="Test Sensor 3")
        db_session.add(sensor)
        db_session.commit()

        alert = Alert(
            sensor_id=sensor.id,
            severity="warning",
            previous_state="normal",
            message="pH dropped below threshold",
        )
        db_session.add(alert)
        db_session.commit()

        assert alert.id is not None
        assert alert.acknowledged_at is None

    def test_notification_recipient_model(self, db_session):
        from db.models import NotificationRecipient

        recipient = NotificationRecipient(
            name="Admin", phone="+6281234567890", email="admin@aquamine.id"
        )
        db_session.add(recipient)
        db_session.commit()

        assert recipient.is_active is True
        assert recipient.notify_warning is True
        assert recipient.notify_critical is True
