from datetime import UTC, datetime, timedelta

import pytest

from criterion.config import Settings

ADMIN = {"username": "ryan", "password": "projector"}
MEMBER = {"username": "guest", "password": ""}
FRIDAY_730PM_CHICAGO = "2030-09-21T00:30:00+00:00"


@pytest.fixture
def settings(data_dir):
    return Settings(
        emby_server_url="http://emby.test",
        emby_server_api="key",
        data_dir=data_dir,
        session_secret="test-session-secret",
        club_admins="Ryan",
        mosaic_collection="",
        club_timezone="America/Chicago",
        frontend_origin="https://club.example.com",
    )


@pytest.fixture
def admin(api):
    api.post("/api/club/login", json=ADMIN)
    return api


def _at(hours: float) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def _create(api, **fields) -> dict:
    body = {"starts_at": _at(48), "status": "published", **fields}
    response = api.post("/api/club/admin/events", json=body)
    assert response.status_code == 201, response.text
    return response.json()["screening"]


def test_a_published_screening_downloads_as_a_calendar_event(admin):
    screening = _create(admin, item_id="m1", location="The basement")
    response = admin.get(f"/api/club/screenings/{screening['id']}/calendar.ics")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/calendar; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]
    body = response.text
    assert "SUMMARY:Criterion Club: There Will Be Blood\r\n" in body
    assert "LOCATION:The basement\r\n" in body
    assert "UID:screening-" in body and "@club.example.com" in body


@pytest.mark.parametrize(
    "status", [pytest.param("draft", id="draft"), pytest.param("cancelled", id="cancelled")]
)
def test_unpublished_screenings_have_no_calendar(admin, status):
    screening = _create(admin, title="Hidden", status=status)
    assert admin.get(f"/api/club/screenings/{screening['id']}/calendar.ics").status_code == 404


def test_a_missing_screening_has_no_calendar(api):
    assert api.get("/api/club/screenings/999/calendar.ics").status_code == 404


def test_the_preview_falls_back_to_the_club_card(api):
    response = api.get("/api/club/og")
    assert response.headers["content-type"].startswith("text/html")
    assert '<meta property="og:title" content="Criterion Club" />' in response.text
    assert (
        '<meta property="og:image" content="https://club.example.com/og-card.png" />'
        in response.text
    )


def test_the_preview_describes_the_next_screening(admin):
    _create(admin, item_id="m1", starts_at=FRIDAY_730PM_CHICAGO, location="The basement")
    text = admin.get("/api/club/og").text
    assert 'content="There Will Be Blood (2007) · Criterion Club"' in text
    assert 'content="Next screening: Friday, September 20 at 7:30 PM · The basement"' in text
    assert "https://club.example.com/api/club-art/" in text and "-og.jpg" in text


def test_the_preview_poster_is_served(admin):
    _create(admin, item_id="m1")
    text = admin.get("/api/club/og").text
    path = text.split('property="og:image" content="https://club.example.com')[1].split('"')[0]
    response = admin.get(path)
    assert (response.status_code, response.headers["content-type"]) == (200, "image/jpeg")


def test_the_preview_escapes_what_admins_type(admin):
    _create(admin, title='Tom & Jerry "Live"', location="<b>Garage</b>")
    text = admin.get("/api/club/og").text
    assert "Tom &amp; Jerry &quot;Live&quot;" in text
    assert "&lt;b&gt;Garage&lt;/b&gt;" in text
    assert "<b>" not in text


def test_refresh_picks_up_changes_in_emby(admin, fake_emby):
    screening = _create(admin, item_id="m1", message="Bring snacks", description="Milkshakes.")
    fake_emby.films[0].update(
        {"Name": "There Will Be Blood (Restored)", "ImageTags": {"Primary": "new"}}
    )
    body = admin.post(f"/api/club/admin/events/{screening['id']}/refresh").json()
    refreshed = body["screening"]
    assert refreshed["title"] == "There Will Be Blood (Restored)"
    assert refreshed["poster_url"] != screening["poster_url"]
    assert (refreshed["message"], refreshed["description"]) == ("Bring snacks", "Milkshakes.")
    assert body["changed"] == ["title", "art_version"]


def test_refresh_when_nothing_changed(admin):
    screening = _create(admin, item_id="m1")
    body = admin.post(f"/api/club/admin/events/{screening['id']}/refresh").json()
    assert body["changed"] == []


def test_refresh_keeps_the_poster_when_emby_loses_it(admin, fake_emby):
    screening = _create(admin, item_id="m1")
    fake_emby.films[0]["ImageTags"] = {}
    refreshed = admin.post(f"/api/club/admin/events/{screening['id']}/refresh").json()
    assert refreshed["screening"]["poster_url"] == screening["poster_url"]


@pytest.mark.parametrize(
    ("setup", "status"),
    [
        pytest.param("typed", 422, id="typed-in-film"),
        pytest.param("gone", 422, id="film-left-the-library"),
        pytest.param("down", 502, id="emby-down"),
    ],
)
def test_refresh_failures(admin, fake_emby, setup, status):
    fields = {"title": "Typed"} if setup == "typed" else {"item_id": "m1"}
    screening = _create(admin, **fields)
    fake_emby.films = [] if setup == "gone" else fake_emby.films
    fake_emby.down = setup == "down"
    assert admin.post(f"/api/club/admin/events/{screening['id']}/refresh").status_code == status


def test_refresh_needs_an_existing_screening(admin):
    assert admin.post("/api/club/admin/events/999/refresh").status_code == 404


@pytest.mark.parametrize(
    "credentials", [pytest.param(None, id="signed-out"), pytest.param(MEMBER, id="member")]
)
def test_only_admins_refresh(admin, credentials):
    screening = _create(admin, item_id="m1")
    admin.post("/api/club/logout")
    admin.post("/api/club/login", json=credentials) if credentials else None
    status = admin.post(f"/api/club/admin/events/{screening['id']}/refresh").status_code
    assert status in {401, 403}


def test_a_library_screening_keeps_its_trailer_and_thumb(admin):
    screening = _create(admin, item_id="m1")
    public = admin.get("/api/club/next").json()["screening"]
    assert public["trailer_url"] == "https://www.youtube.com/watch?v=FeSLPELpMeM"
    assert public["thumb_url"].endswith("-t.webp")
    assert screening["trailer_url"] == public["trailer_url"]


def test_a_typed_screening_has_no_trailer(admin):
    _create(admin, title="Home movie")
    assert admin.get("/api/club/next").json()["screening"]["trailer_url"] is None


def test_refresh_adds_a_trailer_emby_learned_about(admin, fake_emby):
    fake_emby.films[1]["RemoteTrailers"] = []
    screening = _create(admin, item_id="m2")
    fake_emby.films[1]["RemoteTrailers"] = [{"Url": "https://youtu.be/abcdefghijk"}]
    body = admin.post(f"/api/club/admin/events/{screening['id']}/refresh").json()
    assert body["changed"] == ["trailer_url"]
    assert body["screening"]["trailer_url"] == "https://www.youtube.com/watch?v=abcdefghijk"
