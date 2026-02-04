"""Add resolve/reopen fields to alerts

Revision ID: 003_add_alert_resolution_fields
Revises: 002_add_performance_indexes
Create Date: 2026-02-04 00:00:00.000000

"""

import importlib
from typing import Any, cast

import sqlalchemy as sa
from sqlalchemy import inspect


op = cast(Any, importlib.import_module("alembic.op"))


revision = "003_add_alert_resolution_fields"
down_revision = "002_add_performance_indexes"
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = inspector.get_columns(table_name)
    return any(col["name"] == column_name for col in columns)


def upgrade() -> None:
    if not column_exists("alerts", "resolved_at"):
        op.add_column("alerts", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))

    if not column_exists("alerts", "resolved_by"):
        op.add_column("alerts", sa.Column("resolved_by", sa.String(length=100), nullable=True))

    if not column_exists("alerts", "resolution_note"):
        op.add_column("alerts", sa.Column("resolution_note", sa.Text(), nullable=True))

    if not column_exists("alerts", "reopened_at"):
        op.add_column("alerts", sa.Column("reopened_at", sa.DateTime(timezone=True), nullable=True))

    if not column_exists("alerts", "reopened_by"):
        op.add_column("alerts", sa.Column("reopened_by", sa.String(length=100), nullable=True))


def downgrade() -> None:
    if column_exists("alerts", "reopened_by"):
        op.drop_column("alerts", "reopened_by")

    if column_exists("alerts", "reopened_at"):
        op.drop_column("alerts", "reopened_at")

    if column_exists("alerts", "resolution_note"):
        op.drop_column("alerts", "resolution_note")

    if column_exists("alerts", "resolved_by"):
        op.drop_column("alerts", "resolved_by")

    if column_exists("alerts", "resolved_at"):
        op.drop_column("alerts", "resolved_at")
