import pytest
from fastapi.testclient import TestClient
from ai.main import app, INGEST_API_KEY, get_current_user
from ai.db.connection import get_db


class DummySession:
    async def execute(self, stmt):
        class Result:
            def scalars(self):
                class Scalars:
                    def all(self):
                        return []

                return Scalars()

            def scalar_one_or_none(self):
                return None

        return Result()

    def add(self, obj):
        pass

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_db():
    session = DummySession()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides = {}


def test_ingest_rejects_missing_key(client, mock_db):
    response = client.post(
        "/api/v1/sensors/ingest",
        json={"sensor_id": 1, "timestamp": "2023-01-01T00:00:00Z", "readings": {}},
    )
    # Expect 500 if key not set in env (default in test) or 401 if key set but missing in header
    # In test env, INGEST_API_KEY might be None.
    # Logic: if not INGEST_API_KEY: raise 500.
    # So we expect 500 here unless we mock os.environ or INGEST_API_KEY constant.
    # Since INGEST_API_KEY is imported at module level, it's None.
    assert response.status_code == 500


def test_ingest_rejects_invalid_key(client, mock_db, monkeypatch):
    # We need to patch verify_ingest_token or INGEST_API_KEY.
    # Since INGEST_API_KEY is global, it's hard to patch after import without reloading.
    # But verify_ingest_token reads it.
    # Actually, verify_ingest_token reads the global variable INGEST_API_KEY from ai.main.
    # We can patch ai.main.INGEST_API_KEY.
    import ai.main

    monkeypatch.setattr(ai.main, "INGEST_API_KEY", "secret-key")

    response = client.post(
        "/api/v1/sensors/ingest",
        json={"sensor_id": 1, "timestamp": "2023-01-01T00:00:00Z", "readings": {}},
        headers={"X-Ingest-Key": "wrong-key"},
    )
    assert response.status_code == 401


def test_ingest_accepts_valid_key(client, mock_db, monkeypatch):
    import ai.main

    monkeypatch.setattr(ai.main, "INGEST_API_KEY", "secret-key")

    response = client.post(
        "/api/v1/sensors/ingest",
        json={"sensor_id": 1, "timestamp": "2023-01-01T00:00:00Z", "readings": {}},
        headers={"X-Ingest-Key": "secret-key"},
    )
    # It might fail with 422 validation or 404 sensor not found, but NOT 401.
    assert response.status_code != 401
    assert response.status_code != 500


def test_recipients_rejects_unauthenticated(client, mock_db):
    app.dependency_overrides = {}
    response = client.get("/api/v1/recipients")
    assert response.status_code in [401, 403]


def test_recipients_accepts_authenticated(client, mock_db):
    def override_get_current_user():
        return "test-user"

    app.dependency_overrides[get_current_user] = override_get_current_user

    response = client.get("/api/v1/recipients")
    assert response.status_code == 200


def test_alerts_rejects_unauthenticated(client, mock_db):
    app.dependency_overrides = {}
    response = client.get("/api/v1/alerts")
    assert response.status_code in [401, 403]


def test_alerts_accepts_authenticated(client, mock_db):
    def override_get_current_user():
        return "test-user"

    app.dependency_overrides[get_current_user] = override_get_current_user

    response = client.get("/api/v1/alerts")
    assert response.status_code == 200


def test_acknowledge_alert_rejects_unauthenticated(client, mock_db):
    app.dependency_overrides = {}
    response = client.post("/api/v1/alerts/1/acknowledge")
    assert response.status_code in [401, 403]
