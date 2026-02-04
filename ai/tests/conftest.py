import os
import hashlib
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from PIL import Image
import io
from limits.storage import MemoryStorage
from typing import AsyncIterator, cast

from sqlalchemy.sql.schema import Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


# Ensure settings can load during test collection.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://aquamine:changeme@localhost:5432/aquamine_db"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("RATE_LIMIT_ENABLED", "true")
os.environ.setdefault("INGEST_API_KEY", "test-ingest-key")
os.environ.setdefault("CLERK_SECRET_KEY", "test-clerk-secret")
os.environ.setdefault("CLERK_ISSUER", "https://clerk.test")
os.environ.setdefault("ENVIRONMENT", "test")

# Ensure CV path stays deterministic in tests even if ai.main is imported early.
os.environ.setdefault("AQUAMINE_FORCE_MOCK", "1")


@pytest.fixture(autouse=True)
def force_mock_mode(monkeypatch):
    """Force mock inference mode for all tests."""
    monkeypatch.setenv("AQUAMINE_FORCE_MOCK", "1")


@pytest.fixture
def client(request):
    """FastAPI test client."""
    # Import here to ensure env var is set first
    from ai.main import app, limiter

    # Per-test in-memory storage so counters never leak across tests.
    original_storage = getattr(limiter, "_storage", None)
    original_strategy_storage = None
    if hasattr(limiter, "limiter") and hasattr(limiter.limiter, "storage"):
        original_strategy_storage = limiter.limiter.storage

    memory_storage = MemoryStorage()
    if original_storage is not None:
        limiter._storage = memory_storage
    if hasattr(limiter, "limiter") and hasattr(limiter.limiter, "storage"):
        limiter.limiter.storage = memory_storage

    # Avoid cross-test 429s by giving each test a unique client IP.
    digest = hashlib.sha256(request.node.nodeid.encode("utf-8")).digest()
    forwarded_for = f"10.{digest[0]}.{digest[1]}.{digest[2]}"

    with TestClient(app) as test_client:
        test_client.headers.update({"X-Forwarded-For": forwarded_for})
        yield test_client

    if getattr(limiter, "_storage", None) is memory_storage and original_storage is not None:
        limiter._storage = original_storage
    if (
        hasattr(limiter, "limiter")
        and hasattr(limiter.limiter, "storage")
        and limiter.limiter.storage is memory_storage
        and original_strategy_storage is not None
    ):
        limiter.limiter.storage = original_strategy_storage


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


TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncIterator[AsyncSession]:
    """Async SQLAlchemy session backed by isolated in-memory SQLite.

    We create only the tables needed for the chat thread model tests to avoid
    SQLite-incompatible DDL in unrelated models (e.g., composite PK/autoincrement).
    """

    # Import after env vars are set above.
    from ai.db.models import Base, ChatThread

    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    chat_threads_table: Table = cast(Table, ChatThread.__table__)

    try:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(
                    sync_conn,
                    tables=[chat_threads_table],
                )
            )

        async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        async with async_session_factory() as session:
            try:
                yield session
            finally:
                await session.rollback()
    finally:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.drop_all(
                    sync_conn,
                    tables=[chat_threads_table],
                )
            )
        await engine.dispose()
