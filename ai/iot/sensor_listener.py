import asyncio
import json
import logging
import sys
import os
import paho.mqtt.client as mqtt
from ai.iot.config import mqtt_config
from ai.iot.mqtt_bridge import process_mqtt_message
from ai.schemas.sensor import SensorDataIngest
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mqtt_listener")

# Global event loop for async processing
loop = None


def on_connect(client, userdata, flags, rc):
    """Callback for when the client receives a CONNACK response from the server."""
    if rc == 0:
        logger.info("Connected to MQTT Broker!")
        topic = f"{mqtt_config.topic_prefix}/#"
        client.subscribe(topic)
        logger.info(f"Subscribed to {topic}")
    else:
        logger.error(f"Failed to connect, return code {rc}")


def on_message(client, userdata, msg):
    """Callback for when a PUBLISH message is received from the server."""
    try:
        payload_str = msg.payload.decode()
        logger.debug(f"Received message on {msg.topic}: {payload_str}")

        data = json.loads(payload_str)

        # Ensure timestamp is datetime
        if "timestamp" in data and isinstance(data["timestamp"], str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))

        # Parse into schema
        ingest_data = SensorDataIngest(**data)

        # Schedule async processing
        if loop:
            asyncio.run_coroutine_threadsafe(process_mqtt_message(ingest_data), loop)
        else:
            logger.warning("Event loop not available for processing message")

    except json.JSONDecodeError:
        logger.error(f"Invalid JSON payload: {msg.payload}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")


async def main_loop():
    """Main async loop to handle MQTT client."""
    global loop
    loop = asyncio.get_running_loop()

    client = mqtt.Client(client_id=mqtt_config.client_id)
    if mqtt_config.username:
        client.username_pw_set(mqtt_config.username, mqtt_config.password)

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(mqtt_config.broker, mqtt_config.port, 60)
        client.loop_start()

        # Keep main loop running
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"MQTT Client Error: {e}")
    finally:
        client.loop_stop()


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        logger.info("Stopping MQTT Listener")
