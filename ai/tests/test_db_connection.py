import pytest
import psycopg
import os
import time

# Connection details from .env (default fallback)
DB_USER = os.getenv("POSTGRES_USER", "aquamine")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "changeme")
DB_NAME = os.getenv("POSTGRES_DB", "aquamine_db")
DB_HOST = "localhost"
DB_PORT = "5432"


def test_timescaledb_extension_loaded():
    """Verify that TimescaleDB extension is installed and loaded."""
    conn_str = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    # Simple retry logic for CI/local startup
    max_retries = 5
    for i in range(max_retries):
        try:
            with psycopg.connect(conn_str) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT extname FROM pg_extension WHERE extname = 'timescaledb';")
                    result = cur.fetchone()
                    assert result is not None, "TimescaleDB extension not found in pg_extension"
                    assert result[0] == "timescaledb"
            break
        except psycopg.OperationalError as e:
            if i == max_retries - 1:
                pytest.fail(f"Could not connect to database: {e}")
            time.sleep(1)
