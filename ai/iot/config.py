import os
from pydantic import BaseModel


class MQTTConfig(BaseModel):
    broker: str = os.getenv("MQTT_BROKER", "broker.hivemq.com")
    port: int = int(os.getenv("MQTT_PORT", 1883))
    topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "aquamine/sensors")
    client_id: str = os.getenv("MQTT_CLIENT_ID", "aquamine_backend_listener")
    username: str = os.getenv("MQTT_USERNAME", "")
    password: str = os.getenv("MQTT_PASSWORD", "")


mqtt_config = MQTTConfig()
