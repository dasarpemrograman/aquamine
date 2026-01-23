import logging
import os
import sys
from typing import Any

import paho.mqtt.client as mqtt

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from iot import config
from iot.mqtt_bridge import process_mqtt_message, PayloadParseError
from db.connection import session_scope

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def on_connect(
    client: mqtt.Client, userdata: dict[str, Any] | None, flags: dict[str, int], rc: int
) -> None:
    if rc == 0:
        logger.info("Connected to MQTT Broker!")
        client.subscribe(config.MQTT_TOPIC)
        client.subscribe(f"{config.MQTT_TOPIC}/+/data")
    else:
        logger.error(f"Failed to connect, return code {rc}")


def on_message(client: mqtt.Client, userdata: dict[str, Any] | None, msg: mqtt.MQTTMessage) -> None:
    try:
        payload = msg.payload.decode()
        logger.debug(f"Received message on topic {msg.topic}")

        with session_scope() as session:
            result = process_mqtt_message(session, payload)

            if result["success"]:
                logger.info(
                    f"Stored reading for sensor {result['sensor_id']} "
                    f"(reading_id={result['reading_id']})"
                )
            else:
                logger.warning(f"Failed to process message: {result['error']}")

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)


def on_disconnect(client: mqtt.Client, userdata: dict[str, Any] | None, rc: int) -> None:
    if rc != 0:
        logger.warning(f"Unexpected disconnect (rc={rc}), attempting reconnect...")


def create_mqtt_client() -> mqtt.Client:
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    if config.MQTT_USERNAME and config.MQTT_PASSWORD:
        client.username_pw_set(config.MQTT_USERNAME, config.MQTT_PASSWORD)

    return client


def main() -> None:
    client = create_mqtt_client()

    try:
        logger.info(f"Connecting to {config.MQTT_BROKER}:{config.MQTT_PORT}...")
        client.connect(config.MQTT_BROKER, config.MQTT_PORT, 60)
        logger.info("Starting MQTT loop...")
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Could not connect to MQTT Broker: {e}")
        sys.exit(1)
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
