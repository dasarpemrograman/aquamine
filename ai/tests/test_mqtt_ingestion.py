import pytest
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from ai.iot.mqtt_bridge import process_mqtt_message
from ai.schemas.sensor import SensorDataIngest


@pytest.fixture
def valid_payload():
    return SensorDataIngest(
        sensor_id="TEST_SENSOR_001",
        timestamp=datetime.now(timezone.utc),
        location={"lat": -6.2, "lon": 106.8},
        readings={"ph": 7.2, "turbidity": 15.5, "temperature": 28.0},
        metadata={"battery_voltage": 3.9, "signal_strength": -70},
    )


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_auto_registration(mock_session_local, valid_payload):
    # Setup mock session
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    # Mock database query returning None (sensor not found)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    # Run processing
    result = await process_mqtt_message(valid_payload)

    assert result is True
    # Verify sensor was added
    assert mock_session.add.call_count == 2  # 1 for sensor, 1 for reading
    # Verify flush called (to get sensor ID)
    assert mock_session.flush.called
    # Verify commit called
    assert mock_session.commit.called


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_existing_sensor(mock_session_local, valid_payload):
    # Setup mock session
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    # Mock database query returning existing sensor
    mock_sensor = MagicMock()
    mock_sensor.id = 1
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_sensor
    mock_session.execute.return_value = mock_result

    # Run processing
    result = await process_mqtt_message(valid_payload)

    assert result is True
    # Verify only reading was added (sensor already exists)
    assert mock_session.add.call_count == 1
    # Verify commit called
    assert mock_session.commit.called


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_error(mock_session_local, valid_payload):
    # Setup mock session
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    # Mock exception during execution
    mock_session.execute.side_effect = Exception("DB Error")

    with pytest.raises(Exception):
        await process_mqtt_message(valid_payload)

    # Verify rollback called
    assert mock_session.rollback.called
