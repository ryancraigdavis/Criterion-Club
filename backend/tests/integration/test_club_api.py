import pytest
from fastapi.testclient import TestClient

from criterion.main import create_app

RYAN = {"username": "ryan", "password": "projector"}
GUEST = {"username": "guest", "password": ""}


def _sign_in(api, credentials: dict):
    return api.post("/api/club/login", json=credentials)


def test_signed_out_by_default(api):
    assert api.get("/api/club/me").json() == {"name": None, "admin": False}


def test_admin_sign_in_sets_an_http_only_cookie(api):
    response = _sign_in(api, RYAN)
    assert response.status_code == 200
    assert response.json() == {"name": "Ryan", "admin": True}
    cookie = response.headers["set-cookie"]
    assert "club_session=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie
    assert api.get("/api/club/me").json() == {"name": "Ryan", "admin": True}


def test_member_is_signed_in_but_not_an_admin(api):
    assert _sign_in(api, GUEST).json() == {"name": "Guest", "admin": False}
    assert api.get("/api/club/admin/overview").status_code == 403


def test_admin_overview(api):
    assert api.get("/api/club/admin/overview").status_code == 401
    _sign_in(api, RYAN)
    assert api.get("/api/club/admin/overview").json() == {"name": "Ryan"}


@pytest.mark.parametrize(
    ("credentials", "status"),
    [
        pytest.param({"username": "ryan", "password": "wrong"}, 401, id="wrong-password"),
        pytest.param({"username": "nobody", "password": "x"}, 401, id="unknown-user"),
        pytest.param({"username": "", "password": "x"}, 422, id="blank-username"),
        pytest.param({"password": "x"}, 422, id="missing-username"),
    ],
)
def test_rejected_sign_in(api, credentials, status):
    response = _sign_in(api, credentials)
    assert response.status_code == status
    assert "set-cookie" not in response.headers


def test_logout_clears_the_session(api):
    _sign_in(api, RYAN)
    response = api.post("/api/club/logout")
    assert response.json() == {"name": None, "admin": False}
    assert api.get("/api/club/me").json() == {"name": None, "admin": False}


def test_forged_cookie_is_ignored(api):
    api.cookies.set("club_session", "e30.forged")
    assert api.get("/api/club/me").json() == {"name": None, "admin": False}


def test_repeated_failures_are_throttled(api):
    wrong = {"username": "ryan", "password": "nope"}
    statuses = [_sign_in(api, wrong).status_code for _ in range(9)]
    assert statuses == [401] * 8 + [429]
    assert _sign_in(api, RYAN).status_code == 429


@pytest.mark.parametrize(
    ("origin", "status"),
    [
        pytest.param(None, 200, id="no-origin"),
        pytest.param("http://testserver", 200, id="same-host"),
        pytest.param("http://localhost:5173", 200, id="frontend-origin"),
        pytest.param("https://evil.example", 403, id="foreign"),
    ],
)
def test_cross_site_posts_are_refused(api, origin, status):
    headers = {"Origin": origin} if origin else {}
    assert api.post("/api/club/login", json=RYAN, headers=headers).status_code == status


def test_sign_in_unconfigured_without_a_secret(settings, fake_emby):
    unconfigured = settings.model_copy(update={"session_secret": ""})
    with TestClient(create_app(unconfigured, fake_emby)) as client:
        assert _sign_in(client, RYAN).status_code == 503
        assert client.get("/api/club/me").json() == {"name": None, "admin": False}


def test_secure_cookies_in_production(settings, fake_emby):
    production = settings.model_copy(update={"secure_cookies": True})
    with TestClient(create_app(production, fake_emby)) as client:
        assert "Secure" in _sign_in(client, RYAN).headers["set-cookie"]


def test_film_search_returns_library_matches(api, fake_emby):
    films = api.get("/api/club/films", params={"q": "blood"}).json()["films"]
    assert [film["title"] for film in films] == ["There Will Be Blood"]
    assert films[0] == {
        "item_id": "m1",
        "title": "There Will Be Blood",
        "year": 2007,
        "overview": "An oilman builds an empire.",
        "runtime_min": 158,
    }


@pytest.mark.parametrize(
    "query", [pytest.param("", id="empty"), pytest.param("b", id="one-letter")]
)
def test_short_queries_never_reach_emby(api, fake_emby, query):
    assert api.get("/api/club/films", params={"q": query}).json() == {"films": []}
    assert fake_emby.search_calls == []


def test_film_search_reports_an_unreachable_emby(api, fake_emby):
    fake_emby.down = True
    assert api.get("/api/club/films", params={"q": "blood"}).status_code == 502


def test_search_is_open_to_members_who_are_signed_out(api):
    assert api.get("/api/club/films", params={"q": "clerks"}).status_code == 200


def test_health_reports_the_emby_connection(api, fake_emby):
    assert api.get("/api/health").json() == {"status": "ok", "emby_ok": True}
    fake_emby.down = True
    assert api.get("/api/health").json()["emby_ok"] is False
