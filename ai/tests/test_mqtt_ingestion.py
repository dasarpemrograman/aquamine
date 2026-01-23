import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock
import json


class TestMQTTPayloadParser:
    def test_valid_payload_parsed_correctly(self):
        from iot.mqtt_bridge import parse_mqtt_payload

        raw_payload = {
            "sensor_id": "ESP32_AMD_001",
            "timestamp": "2026-01-23T13:45:30Z",
            "location": {"lat": -6.9175, "lon": 107.6191},
            "readings": {"ph": 6.8, "turbidity": 25.4, "temperature": 28.5},
            "metadata": {"battery_voltage": 3.7, "signal_strength": -65},
        }

        result = parse_mqtt_payload(json.dumps(raw_payload))

        assert result.sensor_id == "ESP32_AMD_001"
        assert result.readings["ph"] == 6.8
        assert result.readings["turbidity"] == 25.4
        assert result.readings["temperature"] == 28.5
        assert result.metadata["battery_voltage"] == 3.7

    def test_invalid_json_rejected(self):
        from iot.mqtt_bridge import parse_mqtt_payload, PayloadParseError

        with pytest.raises(PayloadParseError):
            parse_mqtt_payload("not valid json")

    def test_missing_required_fields_rejected(self):
        from iot.mqtt_bridge import parse_mqtt_payload, PayloadParseError

        incomplete_payload = {"sensor_id": "ESP32_001"}

        with pytest.raises(PayloadParseError):
            parse_mqtt_payload(json.dumps(incomplete_payload))

    def test_minimal_payload_accepted(self):
        from iot.mqtt_bridge import parse_mqtt_payload

        minimal_payload = {
            "sensor_id": "ESP32_MINIMAL",
            "timestamp": "2026-01-23T14:00:00Z",
            "readings": {"ph": 7.0},
        }

        result = parse_mqtt_payload(json.dumps(minimal_payload))
        assert result.sensor_id == "ESP32_MINIMAL"
        assert result.readings["ph"] == 7.0


class TestSensorAutoRegistration:
    def test_new_sensor_auto_registered(self, db_session):
        from iot.mqtt_bridge import get_or_create_sensor
        from db.models import Sensor

        sensor = get_or_create_sensor(db_session, "ESP32_NEW_001", "Auto Sensor")

        assert sensor.id is not None
        assert sensor.sensor_id == "ESP32_NEW_001"
        assert sensor.is_active is True

    def test_existing_sensor_returned(self, db_session):
        from iot.mqtt_bridge import get_or_create_sensor
        from db.models import Sensor

        existing = Sensor(sensor_id="ESP32_EXISTING", name="Existing Sensor")
        db_session.add(existing)
        db_session.commit()
        existing_id = existing.id

        sensor = get_or_create_sensor(db_session, "ESP32_EXISTING", "Different Name")

        assert sensor.id == existing_id
        assert sensor.name == "Existing Sensor"


class TestReadingStorage:
    def test_reading_stored_in_database(self, db_session):
        from iot.mqtt_bridge import store_reading
        from db.models import Sensor, Reading

        sensor = Sensor(sensor_id="ESP32_STORE_001", name="Storage Test")
        db_session.add(sensor)
        db_session.commit()

        reading = store_reading(
            db_session,
            sensor_id=sensor.id,
            timestamp=datetime.now(timezone.utc),
            ph=6.5,
            turbidity=30.0,
            temperature=27.0,
            battery_voltage=3.8,
            signal_strength=-55,
        )

        assert reading.id is not None
        assert reading.ph == 6.5
        assert reading.turbidity == 30.0

    def test_reading_with_missing_optional_fields(self, db_session):
        from iot.mqtt_bridge import store_reading
        from db.models import Sensor

        sensor = Sensor(sensor_id="ESP32_PARTIAL", name="Partial Reading Test")
        db_session.add(sensor)
        db_session.commit()

        reading = store_reading(
            db_session,
            sensor_id=sensor.id,
            timestamp=datetime.now(timezone.utc),
            ph=7.0,
        )

        assert reading.id is not None
        assert reading.ph == 7.0
        assert reading.turbidity is None
        assert reading.temperature is None


class TestMQTTBridgeIntegration:
    def test_full_ingestion_flow(self, db_session):
        from iot.mqtt_bridge import process_mqtt_message
        from db.models import Reading

        payload = json.dumps(
            {
                "sensor_id": "ESP32_FLOW_001",
                "timestamp": "2026-01-23T15:00:00Z",
                "readings": {"ph": 6.2, "turbidity": 45.0, "temperature": 29.0},
            }
        )

        result = process_mqtt_message(db_session, payload)

        assert result["success"] is True
        assert result["sensor_id"] == "ESP32_FLOW_001"

        readings = (
            db_session.query(Reading).filter(Reading.sensor.has(sensor_id="ESP32_FLOW_001")).all()
        )
        assert len(readings) == 1
        assert readings[0].ph == 6.2
