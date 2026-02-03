import os
import sys
import logging
from typing import Optional, List, Literal, Any
from pydantic import BaseModel, ValidationError, field_validator

# Configure logger
logger = logging.getLogger(__name__)


class Settings(BaseModel):
    # Core Infrastructure (Required)
    DATABASE_URL: str
    REDIS_URL: str
    INGEST_API_KEY: str

    # Auth (Required)
    CLERK_SECRET_KEY: str
    CLERK_ISSUER: str

    # Environment
    ENVIRONMENT: Literal["development", "production", "test"] = "development"

    # Feature Flags
    RATE_LIMIT_ENABLED: bool = True

    # Network / Security
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Optional Services (TimeGPT, Email, WA, Chatbot)
    NIXTLA_API_KEY: Optional[str] = None
    RESEND_API_KEY: Optional[str] = None
    FONNTE_API_TOKEN: Optional[str] = None
    CEREBRAS_API_KEY: Optional[str] = None

    # Compliance standards (separate from alert/anomaly thresholds)
    COMPLIANCE_PH_MIN: float = 6.5
    COMPLIANCE_PH_MAX: float = 8.5
    COMPLIANCE_TURBIDITY_MAX_NTU: float = 50
    COMPLIANCE_TEMPERATURE_MAX_C: float = 35
    COMPLIANCE_STANDARD_SOURCE: str = "Kepmenkes/PROPER"

    # IoT / MQTT Configuration (With Defaults)
    MQTT_BROKER: str = "broker.hivemq.com"
    MQTT_PORT: int = 1883
    MQTT_TOPIC_PREFIX: str = "aquamine/sensors"
    MQTT_CLIENT_ID: str = "aquamine_backend_listener"
    MQTT_USERNAME: Optional[str] = ""
    MQTT_PASSWORD: Optional[str] = ""

    # Constants (previously in main.py or other files, moving here is optional but cleaner)
    # Keeping them in their respective files for now to minimize refactor impact

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @classmethod
    def load(cls) -> "Settings":
        """
        Load settings from environment variables with validation.
        Exits the application if required variables are missing.
        """
        # Collect environment variables that match model fields
        # Note: We rely on os.getenv to fetch values.
        # For required fields without defaults, passing None (if missing) will cause ValidationError

        env_vars = {}
        for field_name in cls.model_fields:
            val = os.getenv(field_name)
            if val is not None:
                env_vars[field_name] = val

        try:
            return cls(**env_vars)
        except ValidationError as e:
            # Format error message for developer visibility
            print("\n❌ Startup Failed: Invalid or missing environment variables", file=sys.stderr)
            print("-----------------------------------------------------------", file=sys.stderr)
            for error in e.errors():
                loc = ".".join(str(loc_part) for loc_part in error["loc"])
                msg = error["msg"]
                # Provide hints for common errors
                hint = ""
                if "Field required" in msg:
                    hint = " (Check your .env file)"
                print(f" - {loc}: {msg}{hint}", file=sys.stderr)
            print("-----------------------------------------------------------", file=sys.stderr)
            sys.exit(1)


# Singleton instance
settings = Settings.load()
