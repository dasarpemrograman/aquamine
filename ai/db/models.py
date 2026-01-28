from datetime import datetime
from typing import Optional, List, Any
from sqlalchemy import (
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    event,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from .connection import Base


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(primary_key=True)
    sensor_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    readings: Mapped[List["Reading"]] = relationship(back_populates="sensor")
    predictions: Mapped[List["Prediction"]] = relationship(back_populates="sensor")
    anomalies: Mapped[List["Anomaly"]] = relationship(back_populates="sensor")
    alerts: Mapped[List["Alert"]] = relationship(back_populates="sensor")
    alert_state: Mapped["SensorAlertState"] = relationship(back_populates="sensor", uselist=False)


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, primary_key=True
    )
    ph: Mapped[Optional[float]] = mapped_column(Float)
    turbidity: Mapped[Optional[float]] = mapped_column(Float)
    temperature: Mapped[Optional[float]] = mapped_column(Float)
    battery_voltage: Mapped[Optional[float]] = mapped_column(Float)
    signal_strength: Mapped[Optional[int]] = mapped_column(Integer)

    # Composite PK (id, timestamp) required for TimescaleDB hypertables
    # TimescaleDB will handle partitioning automatically via hypertable
    __table_args__ = ()

    sensor: Mapped["Sensor"] = relationship(back_populates="readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    forecast_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    forecast_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parameter: Mapped[str] = mapped_column(String(20), nullable=False)
    forecast_values: Mapped[Any] = mapped_column(JSON, nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(String(50))

    sensor: Mapped["Sensor"] = relationship(back_populates="predictions")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parameter: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float)
    detection_method: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sensor: Mapped["Sensor"] = relationship(back_populates="anomalies")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    previous_state: Mapped[Optional[str]] = mapped_column(String(20))
    message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(100))

    sensor: Mapped["Sensor"] = relationship(back_populates="alerts")


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_warning: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_critical: Mapped[bool] = mapped_column(Boolean, default=True)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(String(100), primary_key=True, unique=True, nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_critical: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_warning: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_info: Mapped[bool] = mapped_column(Boolean, default=False)
    quiet_hours_start: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    quiet_hours_end: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False)
    refresh_interval_seconds: Mapped[int] = mapped_column(Integer, default=10)
    last_notification_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SensorAlertState(Base):
    __tablename__ = "sensor_alert_state"

    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), primary_key=True)
    current_state: Mapped[str] = mapped_column(String(20), default="normal")
    last_alert_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_notification_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    sensor: Mapped["Sensor"] = relationship(back_populates="alert_state")


# Event listener to convert readings table to hypertable after creation
@event.listens_for(Reading.__table__, "after_create")
def create_hypertable_listener(_target, connection, **_kw):
    # Only try to create hypertable if TimescaleDB extension is available
    # We use execute with text() for DDL
    try:
        connection.execute(
            text(
                "SELECT create_hypertable('readings', 'timestamp', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE readings SET (timescaledb.compress, timescaledb.compress_orderby = 'timestamp DESC', timescaledb.compress_segmentby = 'sensor_id');"
            )
        )
        connection.execute(text("SELECT add_compression_policy('readings', INTERVAL '3 days');"))
        connection.execute(text("SELECT add_retention_policy('readings', INTERVAL '2 years');"))
    except Exception as e:
        print(f"Warning: Could not convert to hypertable (might be missing extension): {e}")
