import pytest
from fastapi.testclient import TestClient
from PIL import Image
import io
import os
import psycopg


@pytest.fixture(autouse=True)
def force_mock_mode(monkeypatch):
    """Force mock inference mode for all tests."""
    monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")


@pytest.fixture
def client():
    """FastAPI test client."""
    # Import here to ensure env var is set first
    from main import app

    return TestClient(app)


@pytest.fixture
def sample_jpg_bytes():
    """Generate a sample JPEG image."""
    img = Image.new("RGB", (200, 200), color="orange")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def sample_png_bytes():
    """Generate a sample PNG image."""
    img = Image.new("RGB", (150, 150), color="yellow")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def small_image_bytes():
    """Generate a small image (< 100x100)."""
    img = Image.new("RGB", (50, 50), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def corrupted_bytes():
    """Generate corrupted/invalid image bytes."""
    return b"not a valid image file content"


@pytest.fixture(scope="session")
def db_connection():
    """Database connection for integration tests."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        pytest.skip("DATABASE_URL not set")

    if db_url.startswith("postgresql+psycopg://"):
        db_url = db_url.replace("postgresql+psycopg://", "postgresql://")

    conn = psycopg.connect(db_url)
    yield conn
    conn.close()
