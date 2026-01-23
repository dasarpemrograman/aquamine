import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from ai.realtime.websocket import ConnectionManager


@pytest.fixture
def manager():
    return ConnectionManager()


@pytest.mark.asyncio
async def test_websocket_connect_disconnect(manager):
    websocket = AsyncMock()
    await manager.connect(websocket)
    assert len(manager.active_connections) == 1
    assert websocket.accept.called

    manager.disconnect(websocket)
    assert len(manager.active_connections) == 0


@pytest.mark.asyncio
async def test_broadcast(manager):
    websocket1 = AsyncMock()
    websocket2 = AsyncMock()
    await manager.connect(websocket1)
    await manager.connect(websocket2)

    message = "test update"
    await manager.broadcast(message)

    websocket1.send_text.assert_awaited_with(message)
    websocket2.send_text.assert_awaited_with(message)


@pytest.mark.asyncio
@patch("redis.asyncio.from_url")
async def test_publish_update(mock_redis_url, manager):
    mock_redis = AsyncMock()
    mock_redis_url.return_value = mock_redis

    await manager.publish_update("sensor_reading", {"value": 123})

    mock_redis.publish.assert_called_once()
    args = mock_redis.publish.call_args[0]
    assert args[0] == "aquamine:updates"
    payload = json.loads(args[1])
    assert payload["type"] == "sensor_reading"
    assert payload["data"]["value"] == 123
