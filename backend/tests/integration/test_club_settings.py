import pytest

ADMIN = {"username": "ryan", "password": "projector"}
MEMBER = {"username": "guest", "password": ""}


def test_the_schedule_shows_by_default(api):
    assert api.get("/api/club/settings").json() == {"show_schedule": True}


def test_an_admin_can_hide_the_schedule(api):
    api.post("/api/club/login", json=ADMIN)
    saved = api.post("/api/club/admin/settings", json={"show_schedule": False}).json()
    assert saved == {"show_schedule": False}
    api.post("/api/club/logout")
    assert api.get("/api/club/settings").json() == {"show_schedule": False}


@pytest.mark.parametrize(
    "credentials", [pytest.param(None, id="signed-out"), pytest.param(MEMBER, id="member")]
)
def test_only_admins_change_settings(api, credentials):
    api.post("/api/club/login", json=credentials) if credentials else None
    response = api.post("/api/club/admin/settings", json={"show_schedule": False})
    assert response.status_code in {401, 403}


def test_cross_site_changes_are_refused(api):
    api.post("/api/club/login", json=ADMIN)
    headers = {"Origin": "https://evil.example"}
    response = api.post("/api/club/admin/settings", json={"show_schedule": False}, headers=headers)
    assert response.status_code == 403
