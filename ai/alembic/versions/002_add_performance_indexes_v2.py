"""Add performance indexes for query hotspots

Revision ID: 002_add_performance_indexes
Revises: 001_add_chat_missing_columns
Create Date: 2026-02-03 00:00:00.000000

"""

import importlib
from typing import Any, cast

from sqlalchemy import inspect


op = cast(Any, importlib.import_module("alembic.op"))

revision = "002_add_performance_indexes"
down_revision = "001_add_chat_missing_columns"
branch_labels = None
depends_on = None


def index_exists(table_name: str, index_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    indexes = inspector.get_indexes(table_name)
    return any(idx.get("name") == index_name for idx in indexes)


def upgrade() -> None:
    # readings(sensor_id, timestamp)
    if not index_exists("readings", "ix_readings_sensor_id_timestamp_desc"):
        op.create_index(
            "ix_readings_sensor_id_timestamp_desc",
            "readings",
            ["sensor_id", "timestamp"],
        )

    # alerts(created_at)
    if not index_exists("alerts", "ix_alerts_created_at_desc"):
        op.create_index(
            "ix_alerts_created_at_desc",
            "alerts",
            ["created_at"],
        )

    # alerts(sensor_id, created_at)
    if not index_exists("alerts", "ix_alerts_sensor_id_created_at_desc"):
        op.create_index(
            "ix_alerts_sensor_id_created_at_desc",
            "alerts",
            ["sensor_id", "created_at"],
        )

    # anomalies(sensor_id, timestamp)
    if not index_exists("anomalies", "ix_anomalies_sensor_id_timestamp_desc"):
        op.create_index(
            "ix_anomalies_sensor_id_timestamp_desc",
            "anomalies",
            ["sensor_id", "timestamp"],
        )

    # anomalies(timestamp)
    if not index_exists("anomalies", "ix_anomalies_timestamp_desc"):
        op.create_index(
            "ix_anomalies_timestamp_desc",
            "anomalies",
            ["timestamp"],
        )

    # predictions(sensor_id, created_at)
    if not index_exists("predictions", "ix_predictions_sensor_id_created_at_desc"):
        op.create_index(
            "ix_predictions_sensor_id_created_at_desc",
            "predictions",
            ["sensor_id", "created_at"],
        )


def downgrade() -> None:
    if index_exists("predictions", "ix_predictions_sensor_id_created_at_desc"):
        op.drop_index(
            "ix_predictions_sensor_id_created_at_desc",
            table_name="predictions",
        )

    if index_exists("anomalies", "ix_anomalies_timestamp_desc"):
        op.drop_index(
            "ix_anomalies_timestamp_desc",
            table_name="anomalies",
        )

    if index_exists("anomalies", "ix_anomalies_sensor_id_timestamp_desc"):
        op.drop_index(
            "ix_anomalies_sensor_id_timestamp_desc",
            table_name="anomalies",
        )

    if index_exists("alerts", "ix_alerts_sensor_id_created_at_desc"):
        op.drop_index(
            "ix_alerts_sensor_id_created_at_desc",
            table_name="alerts",
        )

    if index_exists("alerts", "ix_alerts_created_at_desc"):
        op.drop_index(
            "ix_alerts_created_at_desc",
            table_name="alerts",
        )

    if index_exists("readings", "ix_readings_sensor_id_timestamp_desc"):
        op.drop_index(
            "ix_readings_sensor_id_timestamp_desc",
            table_name="readings",
        )
