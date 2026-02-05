"""Add alert evidence table

Revision ID: 004_add_alert_evidence_table
Revises: 003_add_alert_resolution_fields
Create Date: 2026-02-05 00:00:00.000000

"""

import importlib
from typing import Any, cast

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


op = cast(Any, importlib.import_module("alembic.op"))


revision = "004_add_alert_evidence_table"
down_revision = "003_add_alert_resolution_fields"
branch_labels = None
depends_on = None


def table_exists(table_name: str) -> bool:
    conn = op.get_bind()
    inspector = inspect(conn)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not table_exists("alert_evidence"):
        op.create_table(
            "alert_evidence",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("alert_id", sa.Integer(), nullable=False),
            sa.Column("image_data", sa.Text(), nullable=False),
            sa.Column("analysis_result", postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column("attached_by", sa.String(length=100), nullable=True),
            sa.Column(
                "attached_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["alert_id"],
                ["alerts.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_alert_evidence_alert_id"), "alert_evidence", ["alert_id"], unique=False
        )


def downgrade() -> None:
    if table_exists("alert_evidence"):
        op.drop_index(op.f("ix_alert_evidence_alert_id"), table_name="alert_evidence")
        op.drop_table("alert_evidence")
