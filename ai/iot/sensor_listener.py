# pyright: reportUnusedParameter=false, reportPrivateImportUsage=false

import asyncio
from contextlib import suppress
import json
import logging
import ssl
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


def build_mqtt_client() -> mqtt.Client:
    client = mqtt.Client(client_id=mqtt_config.resolved_client_id)

    if mqtt_config.use_tls:
        if mqtt_config.tls_insecure:
            client.tls_set(cert_reqs=ssl.CERT_NONE)
            client.tls_insecure_set(True)
            logger.warning("MQTT TLS certificate verification DISABLED - insecure mode")
        else:
            client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
            logger.info("TLS enabled for MQTT connection with certificate verification")

    if mqtt_config.username:
        client.username_pw_set(mqtt_config.username, mqtt_config.password)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    return client


def _reason_code_value(reason_code) -> int:
    value = getattr(reason_code, "value", reason_code)
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def on_connect(client, _userdata, _flags, reason_code=0, *_extra):
    """Callback for when the client receives a CONNACK response from the server."""
    rc_value = _reason_code_value(reason_code)
    if rc_value == 0:
        logger.info("Connected to MQTT Broker!")
        topic = f"{mqtt_config.topic_prefix}/#"
        client.subscribe(topic)
        logger.info(f"Subscribed to {topic}")
    else:
        logger.error("Failed to connect, return code %s", rc_value)


def on_disconnect(_client, _userdata, *args):
    if len(args) >= 2:
        reason_code = args[1]
    elif len(args) == 1:
        reason_code = args[0]
    else:
        reason_code = 0
    rc_value = _reason_code_value(reason_code)
    if rc_value != 0:
        logger.warning("Unexpected MQTT disconnect (rc=%s). Client will retry.", rc_value)
    else:
        logger.info("MQTT client disconnected cleanly")


def on_message(_client, _userdata, msg):
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
            future = asyncio.run_coroutine_threadsafe(
                process_mqtt_message(ingest_data, source="mqtt"),
                loop,
            )
            future.add_done_callback(
                lambda f: logger.error("MQTT message processing failed: %s", f.exception())
                if f.exception()
                else None
            )
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

    logger.info(
        "Starting MQTT listener broker=%s port=%s topic_prefix=%s client_id=%s",
        mqtt_config.broker,
        mqtt_config.port,
        mqtt_config.topic_prefix,
        mqtt_config.resolved_client_id,
    )

    reconnect_delay = 3
    while True:
        client = build_mqtt_client()
        try:
            client.connect(mqtt_config.broker, mqtt_config.port, 60)
            client.loop_start()
            reconnect_delay = 3

            while True:
                await asyncio.sleep(1)
                if not client.is_connected():
                    raise ConnectionError("MQTT client disconnected")
        except Exception as e:
            logger.error("MQTT Client Error: %s", e)
            logger.info("Retrying MQTT connection in %ss", reconnect_delay)
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 30)
        finally:
            with suppress(Exception):
                client.loop_stop()
                client.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        logger.info("Stopping MQTT Listener")
