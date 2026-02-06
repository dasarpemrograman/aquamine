import os
import socket
from pydantic import BaseModel


class MQTTConfig(BaseModel):
    broker: str = os.getenv("MQTT_BROKER", "broker.hivemq.com")
    port: int = int(os.getenv("MQTT_PORT", 1883))
    topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "aquamine/sensors")
    client_id: str = os.getenv("MQTT_CLIENT_ID", "aquamine_backend_listener")
    username: str = os.getenv("MQTT_USERNAME", "")
    password: str = os.getenv("MQTT_PASSWORD", "")
    tls_insecure: bool = os.getenv("MQTT_TLS_INSECURE", "").lower() == "true"
    allowed_sensor_ids_raw: str = os.getenv("SENSOR_ALLOWED_IDS", "")
    auto_register_unknown: bool = (
        os.getenv("SENSOR_AUTO_REGISTER_UNKNOWN", "true").lower() == "true"
    )

    @property
    def use_tls(self) -> bool:
        return self.port == 8883

    @property
    def resolved_client_id(self) -> str:
        """Generate a client id that avoids cross-environment collisions on the broker."""
        base = (self.client_id or "aquamine_backend_listener").strip()
        host = socket.gethostname().replace(".", "-").replace("_", "-")
        suffix = host[:8] if host else "node"
        merged = f"{base}-{suffix}"
        return merged[:60]

    @property
    def allowed_sensor_ids(self) -> set[str]:
        return {
            sensor_id.strip()
            for sensor_id in self.allowed_sensor_ids_raw.split(",")
            if sensor_id.strip()
        }


mqtt_config = MQTTConfig()
