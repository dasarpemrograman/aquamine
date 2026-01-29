from datetime import datetime, timezone

from ai.db.connection import get_db
from ai.db.models import UserSettings
from ai.main import app


class DummyResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class DummySession:
    def __init__(self, initial_settings=None):
        self.settings = initial_settings
        self.added = []
        self.commits = 0
        self.refreshes = 0

    async def execute(self, _stmt):
        return DummyResult(self.settings)

    def add(self, obj):
        self.settings = obj
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        self.refreshes += 1
        if obj.notifications_enabled is None:
            obj.notifications_enabled = True
        if obj.notify_critical is None:
            obj.notify_critical = True
        if obj.notify_warning is None:
            obj.notify_warning = True
        if obj.notify_info is None:
            obj.notify_info = False
        if obj.refresh_interval_seconds is None:
            obj.refresh_interval_seconds = 10
        if obj.created_at is None:
            obj.created_at = datetime.now(timezone.utc)
        if obj.updated_at is None:
            obj.updated_at = datetime.now(timezone.utc)


def _parse_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value.replace("Z", "+00:00")
    return datetime.fromisoformat(value)


def test_get_settings_creates_defaults(client):
    session = DummySession()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    response = client.get("/api/v1/settings/test-user", headers={"x-user-id": "test-user"})
    assert response.status_code == 200
    data = response.json()

    assert data["user_id"] == "test-user"
    assert data["notifications_enabled"] is True
    assert data["notify_critical"] is True
    assert data["notify_warning"] is True
    assert data["notify_info"] is False
    assert data["refresh_interval_seconds"] == 10
    assert data["timezone"] == "UTC"
    assert data["created_at"]
    assert data["updated_at"]

    app.dependency_overrides.pop(get_db, None)


def test_get_settings_rejects_missing_auth_header(client):
    response = client.get("/api/v1/settings/test-user")
    assert response.status_code == 401


def test_get_settings_rejects_mismatched_user_id(client):
    response = client.get("/api/v1/settings/test-user", headers={"x-user-id": "different-user"})
    assert response.status_code == 403


def test_patch_settings_updates_fields(client):
    session = DummySession()

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    now = datetime.now(timezone.utc)
    payload = {
        "refresh_interval_seconds": 15,
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "06:00",
        "timezone": "America/Denver",
        "last_notification_seen_at": now.isoformat(),
    }

    response = client.patch(
        "/api/v1/settings/test-user", json=payload, headers={"x-user-id": "test-user"}
    )
    assert response.status_code == 200
    data = response.json()

    assert data["refresh_interval_seconds"] == 15
    assert data["quiet_hours_start"] == "22:00"
    assert data["quiet_hours_end"] == "06:00"
    assert data["timezone"] == "America/Denver"
    assert _parse_datetime(data["last_notification_seen_at"]) == now

    app.dependency_overrides.pop(get_db, None)


def test_patch_settings_rejects_missing_auth_header(client):
    response = client.patch("/api/v1/settings/test-user", json={"refresh_interval_seconds": 15})
    assert response.status_code == 401


def test_patch_settings_rejects_mismatched_user_id(client):
    response = client.patch(
        "/api/v1/settings/test-user",
        json={"refresh_interval_seconds": 15},
        headers={"x-user-id": "different-user"},
    )
    assert response.status_code == 403


def test_patch_settings_rejects_refresh_interval_out_of_bounds(client):
    session = DummySession(UserSettings(user_id="test-user", timezone="UTC"))

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    response = client.patch(
        "/api/v1/settings/test-user",
        json={"refresh_interval_seconds": 3},
        headers={"x-user-id": "test-user"},
    )
    assert response.status_code == 400

    app.dependency_overrides.pop(get_db, None)


def test_patch_settings_rejects_invalid_quiet_hours_format(client):
    session = DummySession(UserSettings(user_id="test-user", timezone="UTC"))

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    response = client.patch(
        "/api/v1/settings/test-user",
        json={"quiet_hours_start": "25:00"},
        headers={"x-user-id": "test-user"},
    )
    assert response.status_code == 400

    app.dependency_overrides.pop(get_db, None)
