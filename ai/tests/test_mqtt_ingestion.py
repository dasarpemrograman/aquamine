import pytest
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


@pytest.fixture
def _mock_sensor():
    sensor = MagicMock()
    sensor.id = 1
    sensor.sensor_id = "TEST_SENSOR_001"
    return sensor


@pytest.fixture
def _mock_alert_state():
    state = MagicMock()
    state.current_state = "normal"
    state.last_alert_at = None
    return state


def _make_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    result.scalars.return_value.all.return_value = []
    return result


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.ws_manager", new_callable=AsyncMock)
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_auto_registration(
    mock_session_local, mock_ws, valid_payload, _mock_sensor, _mock_alert_state
):
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    # Call sequence:
    # 1) _process_mqtt_logic: sensor lookup → None (auto-register)
    # 2) process_mqtt_message: sensor lookup for alert processing → sensor
    # 3) _process_reading_alerts: alert state lookup → None (new state created)
    mock_session.execute.side_effect = [
        _make_result(None),
        _make_result(_mock_sensor),
        _make_result(_mock_alert_state),
    ]

    result = await process_mqtt_message(valid_payload)

    assert result is True
    assert mock_session.flush.called
    assert mock_session.commit.called


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.ws_manager", new_callable=AsyncMock)
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_existing_sensor(
    mock_session_local, mock_ws, valid_payload, _mock_sensor, _mock_alert_state
):
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    # Call sequence:
    # 1) _process_mqtt_logic: sensor lookup → existing sensor
    # 2) process_mqtt_message: sensor lookup for alert processing → sensor
    # 3) _process_reading_alerts: alert state lookup → existing state
    mock_session.execute.side_effect = [
        _make_result(_mock_sensor),
        _make_result(_mock_sensor),
        _make_result(_mock_alert_state),
    ]

    result = await process_mqtt_message(valid_payload)

    assert result is True
    assert mock_session.commit.called


@pytest.mark.asyncio
async def test_process_mqtt_message_with_provided_session(valid_payload, _mock_sensor):
    mock_session = AsyncMock()
    mock_session.add = MagicMock()

    mock_session.execute.return_value = _make_result(_mock_sensor)

    result = await process_mqtt_message(valid_payload, session=mock_session)

    assert result is True
    assert mock_session.add.call_count == 1
    assert not mock_session.commit.called


@pytest.mark.asyncio
@patch("ai.iot.mqtt_bridge.AsyncSessionLocal")
async def test_process_mqtt_message_error(mock_session_local, valid_payload):
    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    mock_session.execute.side_effect = Exception("DB Error")

    with pytest.raises(Exception):
        await process_mqtt_message(valid_payload)

    assert mock_session.rollback.called
