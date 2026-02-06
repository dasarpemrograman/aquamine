import os
import socket
from pydantic import BaseModel


class MQTTConfig(BaseModel):
    broker: str = os.getenv("MQTT_BROKER", "broker.hivemq.com")
    port: int = int(os.getenv("MQTT_PORT", 1883))
    topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "aquamine/sensors")
    client_id_raw: str = os.getenv("MQTT_CLIENT_ID", "")
    username: str = os.getenv("MQTT_USERNAME", "")
    password: str = os.getenv("MQTT_PASSWORD", "")
    tls_insecure: bool = os.getenv("MQTT_TLS_INSECURE", "").lower() == "true"

    @property
    def use_tls(self) -> bool:
        return self.port == 8883

    @property
    def resolved_client_id(self) -> str:
        """Use explicit client id when provided; otherwise derive host-suffixed default."""
        explicit_client_id = self.client_id_raw.strip()
        if explicit_client_id:
            return explicit_client_id[:60]

        base = "aquamine_backend_listener"
        host = socket.gethostname().replace(".", "-").replace("_", "-")
        suffix = host[:8] if host else "node"
        merged = f"{base}-{suffix}"
        return merged[:60]


mqtt_config = MQTTConfig()
