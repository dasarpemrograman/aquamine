import asyncio
import json
import os
from datetime import datetime
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def send_personal(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)


def format_reading_message(reading_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "reading",
        "timestamp": datetime.utcnow().isoformat(),
        "data": reading_data,
    }


def format_alert_message(alert_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "alert",
        "timestamp": datetime.utcnow().isoformat(),
        "data": alert_data,
    }


async def create_redis_subscriber(redis_url: str | None = None):
    url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")

    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(url)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("aquamine:readings", "aquamine:alerts")

        return pubsub

    except ImportError:
        return None
    except Exception:
        return None


async def redis_listener(manager: WebSocketManager, redis_url: str | None = None):
    pubsub = await create_redis_subscriber(redis_url)

    if pubsub is None:
        return

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    channel = (
                        message["channel"].decode()
                        if isinstance(message["channel"], bytes)
                        else message["channel"]
                    )

                    if "readings" in channel:
                        await manager.broadcast(format_reading_message(data))
                    elif "alerts" in channel:
                        await manager.broadcast(format_alert_message(data))

                except json.JSONDecodeError:
                    continue

    except asyncio.CancelledError:
        await pubsub.unsubscribe()
        raise


async def publish_reading(reading_data: dict[str, Any], redis_url: str | None = None) -> bool:
    url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")

    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(url)
        await redis_client.publish("aquamine:readings", json.dumps(reading_data))
        await redis_client.close()
        return True

    except Exception:
        return False


async def publish_alert(alert_data: dict[str, Any], redis_url: str | None = None) -> bool:
    url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")

    try:
        import redis.asyncio as redis

        redis_client = redis.from_url(url)
        await redis_client.publish("aquamine:alerts", json.dumps(alert_data))
        await redis_client.close()
        return True

    except Exception:
        return False


manager = WebSocketManager()
