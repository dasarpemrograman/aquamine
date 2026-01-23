import asyncio
import logging
import json
import redis.asyncio as redis
from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict
import os

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis: redis.Redis = None
        self.pubsub = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Active clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                self.disconnect(connection)

    async def start_redis_listener(self):
        """Subscribe to Redis channels and forward to WebSockets."""
        self.redis = redis.from_url(self.redis_url)
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe("aquamine:updates")

        logger.info("Redis listener started")

        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = message["data"].decode("utf-8")
                    await self.broadcast(data)
        except Exception as e:
            logger.error(f"Redis listener error: {e}")

    async def publish_update(self, type: str, data: Dict):
        """Publish update to Redis."""
        if not self.redis:
            self.redis = redis.from_url(self.redis_url)

        message = json.dumps(
            {
                "type": type,
                "timestamp": str(asyncio.get_event_loop().time()),  # simple timestamp
                "data": data,
            }
        )
        await self.redis.publish("aquamine:updates", message)


manager = ConnectionManager()
