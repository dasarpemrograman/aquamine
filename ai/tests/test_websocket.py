import unittest
import sys
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timezone


class TestWebSocketManager(unittest.IsolatedAsyncioTestCase):
    def test_websocket_connection_established(self):
        from realtime.websocket import WebSocketManager

        manager = WebSocketManager()
        self.assertEqual(manager.active_connections, [])

    async def test_connect_adds_to_active_connections(self):
        from realtime.websocket import WebSocketManager

        manager = WebSocketManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws)

        self.assertIn(mock_ws, manager.active_connections)
        mock_ws.accept.assert_called_once()

    async def test_disconnect_removes_from_active_connections(self):
        from realtime.websocket import WebSocketManager

        manager = WebSocketManager()
        mock_ws = AsyncMock()

        await manager.connect(mock_ws)
        manager.disconnect(mock_ws)

        self.assertNotIn(mock_ws, manager.active_connections)

    async def test_broadcast_sends_to_all_connections(self):
        from realtime.websocket import WebSocketManager

        manager = WebSocketManager()
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()

        await manager.connect(mock_ws1)
        await manager.connect(mock_ws2)

        await manager.broadcast({"type": "test", "data": "hello"})

        mock_ws1.send_json.assert_called_once()
        mock_ws2.send_json.assert_called_once()


class TestReadingsBroadcast(unittest.IsolatedAsyncioTestCase):
    async def test_readings_broadcast_format(self):
        from realtime.websocket import format_reading_message

        reading_data = {
            "sensor_id": "ESP32_001",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ph": 6.8,
            "turbidity": 25.0,
            "temperature": 28.0,
        }

        message = format_reading_message(reading_data)

        self.assertEqual(message["type"], "reading")
        self.assertEqual(message["data"]["sensor_id"], "ESP32_001")
        self.assertIn("ph", message["data"])


class TestAlertBroadcast(unittest.IsolatedAsyncioTestCase):
    async def test_alert_broadcast_format(self):
        from realtime.websocket import format_alert_message

        alert_data = {
            "sensor_id": 1,
            "sensor_name": "Test Sensor",
            "severity": "warning",
            "message": "pH below threshold",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        message = format_alert_message(alert_data)

        self.assertEqual(message["type"], "alert")
        self.assertEqual(message["data"]["severity"], "warning")


class TestClientDisconnectHandling(unittest.IsolatedAsyncioTestCase):
    async def test_client_disconnect_handled_gracefully(self):
        from realtime.websocket import WebSocketManager

        manager = WebSocketManager()
        mock_ws = AsyncMock()
        mock_ws.send_json.side_effect = Exception("Connection closed")

        await manager.connect(mock_ws)

        await manager.broadcast({"type": "test"})

        self.assertNotIn(mock_ws, manager.active_connections)


class TestRedisIntegration(unittest.IsolatedAsyncioTestCase):
    async def test_redis_pubsub_subscription(self):
        from realtime.websocket import create_redis_subscriber

        with patch("redis.asyncio.from_url") as mock_from_url:
            # redis_client itself can be a regular Mock, but methods we await must be AsyncMock
            mock_redis_instance = Mock()
            mock_from_url.return_value = mock_redis_instance

            # pubsub() is synchronous, so it returns a mock immediately
            mock_pubsub = AsyncMock()
            mock_redis_instance.pubsub.return_value = mock_pubsub

            # subscribe() is async, so AsyncMock handles it (returns awaitable)

            subscriber = await create_redis_subscriber("redis://localhost:6379")

            self.assertIsNotNone(subscriber)
