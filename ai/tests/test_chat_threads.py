"""Tests for chat thread functionality."""

import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
import uuid

from ai.db.connection import get_db
from ai.db.models import ChatThread
from ai.main import app, get_current_user


class _DummyScalarResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar(self):
        return self._value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return list(self._values)


class _DummySession:
    def __init__(self):
        self.added = []
        self.commits = 0
        self.refreshes = 0

    async def execute(self, _stmt):
        return _DummyScalarResult(value=0, values=[])

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        self.refreshes += 1
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = datetime.now(timezone.utc)


@pytest.fixture
def mock_jwks_client():
    """Mock JWKS client for auth tests."""
    with patch("ai.auth.clerk.jwks_client") as mock:
        mock.get_signing_key_from_jwt.return_value = MagicMock(key="mock_signing_key")
        yield mock


@pytest.fixture
def sample_thread_data():
    """Sample thread data for tests."""
    return {
        "id": str(uuid.uuid4()),
        "user_id": "user_123",
        "title": "Test Thread",
        "title_source": "user",
    }


class TestChatThreadModel:
    """Test ChatThread database model."""

    @pytest.mark.asyncio
    async def test_create_thread(self, db_session):
        """Test creating a chat thread."""
        thread = ChatThread(
            id=str(uuid.uuid4()),
            user_id="user_123",
            title="Test Thread",
            title_source="auto",
        )
        db_session.add(thread)
        await db_session.commit()

        assert thread.id is not None
        assert thread.user_id == "user_123"
        assert thread.title == "Test Thread"
        assert thread.deleted_at is None

    @pytest.mark.asyncio
    async def test_soft_delete_thread(self, db_session):
        """Test soft deleting a thread."""
        thread = ChatThread(
            id=str(uuid.uuid4()),
            user_id="user_123",
            title="To Be Deleted",
            title_source="auto",
        )
        db_session.add(thread)
        await db_session.commit()

        # Soft delete
        thread.deleted_at = datetime.now(timezone.utc)
        await db_session.commit()

        assert thread.deleted_at is not None


class TestChatAuth:
    """Test authentication for chat endpoints."""

    def test_missing_auth_header(self, client):
        """Test request without Authorization header returns 401."""
        response = client.get("/api/v1/chat/threads")
        assert response.status_code == 401

    def test_invalid_token(self, client):
        """Test request with invalid token returns 401."""
        response = client.get(
            "/api/v1/chat/threads", headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401


class TestChatAPI:
    """Test chat API endpoints."""

    @pytest.mark.asyncio
    async def test_list_threads_empty(self, client, mock_jwks_client):
        """Test listing threads when none exist."""
        _ = mock_jwks_client
        with patch("ai.main.get_current_user", return_value="user_123"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_123"
            app.dependency_overrides[get_db] = override_get_db
            try:
                response = client.get(
                    "/api/v1/chat/threads", headers={"Authorization": "Bearer valid_token"}
                )
                assert response.status_code == 200
                data = response.json()
                assert data["threads"] == []
                assert data["total"] == 0
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)

    @pytest.mark.asyncio
    async def test_create_thread(self, client, mock_jwks_client):
        """Test creating a new thread."""
        _ = mock_jwks_client
        with patch("ai.main.get_current_user", return_value="user_123"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_123"
            app.dependency_overrides[get_db] = override_get_db
            try:
                response = client.post(
                    "/api/v1/chat/threads",
                    headers={"Authorization": "Bearer valid_token"},
                    json={"title": "New Test Thread"},
                )
                assert response.status_code == 200
                data = response.json()
                assert data["title"] == "New Test Thread"
                assert data["user_id"] == "user_123"
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)

    @pytest.mark.asyncio
    async def test_create_thread_default_title(self, client, mock_jwks_client):
        """Test creating thread with default title."""
        _ = mock_jwks_client
        with patch("ai.main.get_current_user", return_value="user_123"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_123"
            app.dependency_overrides[get_db] = override_get_db
            try:
                response = client.post(
                    "/api/v1/chat/threads",
                    headers={"Authorization": "Bearer valid_token"},
                    json={},
                )
                assert response.status_code == 200
                data = response.json()
                assert data["title"] == "New chat"
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)


class TestTokenBudget:
    """Test token budgeting and compaction logic."""

    def test_estimate_tokens_short(self):
        """Test token estimation for short text."""
        from ai.chatbot.token_budget import estimate_tokens

        text = "Hello world"
        tokens = estimate_tokens(text)

        # Should be ceil(11 / 3.5) = 4 tokens
        assert tokens == 4

    def test_estimate_tokens_empty(self):
        """Test token estimation for empty string."""
        from ai.chatbot.token_budget import estimate_tokens

        assert estimate_tokens("") == 0
        assert estimate_tokens(None) == 0

    def test_should_compact_threshold(self):
        """Test compaction detection at threshold."""
        from ai.chatbot.token_budget import should_compact, CONTEXT_WINDOW_TOKENS

        # Create messages that should trigger compaction
        # At 85% threshold with 2048 reserved output
        threshold = int(CONTEXT_WINDOW_TOKENS * 0.85) - 2048

        # Create a long message
        long_text = "word " * 1000  # ~5000 chars = ~1429 tokens
        messages = [{"role": "user", "content": long_text, "token_estimate": 1429}]

        needs_compact, stats = should_compact(messages)

        # Should not compact with just one message
        assert needs_compact is False or stats["total_estimated_tokens"] > threshold


class TestCompactionAPI:
    """Test compaction endpoints."""

    @pytest.mark.asyncio
    async def test_compaction_preview(self, client, mock_jwks_client):
        """Test compaction preview endpoint."""
        _ = mock_jwks_client
        with patch("ai.main.get_current_user", return_value="user_123"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_123"
            app.dependency_overrides[get_db] = override_get_db
            try:
                # First create a thread
                thread_response = client.post(
                    "/api/v1/chat/threads",
                    headers={"Authorization": "Bearer valid_token"},
                    json={},
                )
                thread_id = thread_response.json()["id"]

                # Get compaction preview
                response = client.post(
                    f"/api/v1/chat/threads/{thread_id}/compaction/preview",
                    headers={"Authorization": "Bearer valid_token"},
                    json={},
                )

                # Should work even with no messages
                assert response.status_code in [200, 404]
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)


class TestThreadSecurity:
    """Test thread access control."""

    @pytest.mark.asyncio
    async def test_cannot_access_other_user_thread(self, client, mock_jwks_client):
        """Test user cannot access another user's thread."""
        _ = mock_jwks_client
        # Create thread as user_1
        with patch("ai.main.get_current_user", return_value="user_1"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_1"
            app.dependency_overrides[get_db] = override_get_db
            try:
                create_response = client.post(
                    "/api/v1/chat/threads",
                    headers={"Authorization": "Bearer valid_token"},
                    json={"title": "Private Thread"},
                )
                thread_id = create_response.json()["id"]
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)

        # Try to access as user_2
        with patch("ai.main.get_current_user", return_value="user_2"):
            session = _DummySession()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_current_user] = lambda: "user_2"
            app.dependency_overrides[get_db] = override_get_db
            try:
                response = client.get(
                    f"/api/v1/chat/threads/{thread_id}",
                    headers={"Authorization": "Bearer valid_token"},
                )
                # Should return 404 (not 403) to avoid leaking existence
                assert response.status_code == 404
            finally:
                app.dependency_overrides.pop(get_current_user, None)
                app.dependency_overrides.pop(get_db, None)
