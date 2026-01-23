"""Tests for database connection and TimescaleDB setup."""

import pytest
import os


class TestTimescaleDBSetup:
    """Test TimescaleDB extension and configuration."""

    def test_timescaledb_extension_enabled(self, db_connection):
        """TimescaleDB extension should be installed and enabled."""
        cursor = db_connection.cursor()
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'timescaledb'")
        result = cursor.fetchone()
        assert result is not None, "TimescaleDB extension not installed"

    def test_database_connection(self, db_connection):
        """Database should be accessible."""
        cursor = db_connection.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        assert result[0] == 1

    def test_database_url_configured(self):
        """DATABASE_URL environment variable should be set."""
        db_url = os.getenv("DATABASE_URL")
        assert db_url is not None, "DATABASE_URL not configured"
        assert "postgresql" in db_url, "DATABASE_URL should be PostgreSQL"
