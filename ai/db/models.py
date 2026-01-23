from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Sensor(Base):
    __tablename__ = "sensors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    readings: Mapped[list["Reading"]] = relationship("Reading", back_populates="sensor")
    predictions: Mapped[list["Prediction"]] = relationship("Prediction", back_populates="sensor")
    anomalies: Mapped[list["Anomaly"]] = relationship("Anomaly", back_populates="sensor")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="sensor")
    alert_state: Mapped[Optional["SensorAlertState"]] = relationship(
        "SensorAlertState", back_populates="sensor", uselist=False
    )


class Reading(Base):
    """TimescaleDB hypertable - uses composite PK (id, timestamp) for chunk partitioning."""

    __tablename__ = "readings"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensors.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)

    ph: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    turbidity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    battery_voltage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    signal_strength: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensors.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    forecast_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    forecast_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parameter: Mapped[str] = mapped_column(String(20), nullable=False)
    forecast_values: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="predictions")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensors.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parameter: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detection_method: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="anomalies")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensors.id"), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    previous_state: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="alerts")


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_warning: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_critical: Mapped[bool] = mapped_column(Boolean, default=True)


class SensorAlertState(Base):
    """Tracks per-sensor alert state for cooldown logic and notification spam prevention."""

    __tablename__ = "sensor_alert_state"

    sensor_id: Mapped[int] = mapped_column(Integer, ForeignKey("sensors.id"), primary_key=True)
    current_state: Mapped[str] = mapped_column(String(20), default="normal")
    last_alert_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_notification_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    sensor: Mapped["Sensor"] = relationship("Sensor", back_populates="alert_state")
