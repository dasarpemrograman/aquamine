"""Add missing columns to chat tables

Revision ID: 001_add_chat_missing_columns
Revises:
Create Date: 2025-02-02 22:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "001_add_chat_missing_columns"
down_revision = None
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = inspector.get_columns(table_name)
    return any(col["name"] == column_name for col in columns)


def upgrade() -> None:
    if not column_exists("chat_session_segments", "created_at"):
        op.add_column(
            "chat_session_segments",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )

    if not column_exists("chat_threads", "created_at"):
        op.add_column(
            "chat_threads",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )

    if not column_exists("chat_threads", "updated_at"):
        op.add_column(
            "chat_threads",
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )

    if not column_exists("chat_messages", "created_at"):
        op.add_column(
            "chat_messages",
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )


def downgrade() -> None:
    if column_exists("chat_session_segments", "created_at"):
        op.drop_column("chat_session_segments", "created_at")

    if column_exists("chat_threads", "created_at"):
        op.drop_column("chat_threads", "created_at")

    if column_exists("chat_threads", "updated_at"):
        op.drop_column("chat_threads", "updated_at")

    if column_exists("chat_messages", "created_at"):
        op.drop_column("chat_messages", "created_at")
