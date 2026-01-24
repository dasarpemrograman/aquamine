import logging
from typing import Any

from sqlalchemy import desc, select

from ai.chatbot.knowledge_base import KnowledgeBase
from ai.db.connection import AsyncSessionLocal
from ai.db.models import Alert, Reading

logger = logging.getLogger(__name__)

_knowledge_base = KnowledgeBase()


async def retrieve_knowledge(query: str) -> list[str]:
    return _knowledge_base.search(query, k=3)


async def get_sensor_data(sensor_id: int, limit: int = 10) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Reading)
            .where(Reading.sensor_id == sensor_id)
            .order_by(desc(Reading.timestamp))
            .limit(limit)
        )
        readings = result.scalars().all()
    return [_serialize_reading(reading) for reading in readings]


async def get_recent_alerts(sensor_id: int, limit: int = 5) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Alert)
            .where(Alert.sensor_id == sensor_id)
            .order_by(desc(Alert.created_at))
            .limit(limit)
        )
        alerts = result.scalars().all()
    return [_serialize_alert(alert) for alert in alerts]


def _serialize_reading(reading: Reading) -> dict[str, Any]:
    return {
        "id": reading.id,
        "sensor_id": reading.sensor_id,
        "timestamp": reading.timestamp.isoformat(),
        "ph": reading.ph,
        "turbidity": reading.turbidity,
        "temperature": reading.temperature,
        "battery_voltage": reading.battery_voltage,
        "signal_strength": reading.signal_strength,
    }


def _serialize_alert(alert: Alert) -> dict[str, Any]:
    return {
        "id": alert.id,
        "sensor_id": alert.sensor_id,
        "severity": alert.severity,
        "previous_state": alert.previous_state,
        "message": alert.message,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "acknowledged_by": alert.acknowledged_by,
    }


TOOLS_SCHEMA: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "retrieve_knowledge",
            "description": "Search the knowledge base for relevant reference content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for the knowledge base.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_data",
            "description": "Fetch recent sensor readings by database sensor id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sensor_id": {
                        "type": "integer",
                        "description": "Database id of the sensor.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of readings to return.",
                        "default": 10,
                    },
                },
                "required": ["sensor_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_alerts",
            "description": "Fetch recent alerts by database sensor id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sensor_id": {
                        "type": "integer",
                        "description": "Database id of the sensor.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of alerts to return.",
                        "default": 5,
                    },
                },
                "required": ["sensor_id"],
            },
        },
    },
]
