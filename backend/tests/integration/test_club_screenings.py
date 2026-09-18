from datetime import UTC, datetime, timedelta

import pytest

ADMIN = {"username": "ryan", "password": "projector"}
MEMBER = {"username": "guest", "password": ""}


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


def test_library_film_fills_itself_in(admin):
    screening = _create(admin, item_id="m1", message="Bring snacks", location="Living room")
    assert screening["title"] == "There Will Be Blood"
    assert screening["year"] == 2007
    assert screening["description"] == "An oilman builds an empire."
    assert screening["poster_url"].startswith("/api/club-art/")
    assert screening["runtime_min"] == 158
    assert screening["message"] == "Bring snacks"


def test_written_description_beats_the_synopsis(admin):
    screening = _create(admin, item_id="m1", description="Milkshakes.")
    assert screening["description"] == "Milkshakes."


def test_other_film_uses_the_typed_details(admin, mocker):
    cache = mocker.patch("criterion.club.art.cache_url", mocker.AsyncMock(return_value="v1"))
    screening = _create(
        admin, title="  Paris, Texas ", year=1984, art_url="https://img.example/paris.jpg"
    )
    assert (screening["title"], screening["year"], screening["item_id"]) == (
        "Paris, Texas",
        1984,
        None,
    )
    assert screening["poster_url"] == "/api/club-art/v1.webp"
    assert cache.await_count == 1


@pytest.mark.parametrize(
    ("fields", "status"),
    [
        pytest.param({"title": "   "}, 422, id="no-title"),
        pytest.param({"item_id": "nope"}, 422, id="unknown-film"),
        pytest.param({"title": "X", "starts_at": "2026-09-19T19:30:00"}, 422, id="naive-time"),
        pytest.param({"title": "X", "art_url": "file:///etc/passwd"}, 422, id="non-http-art"),
        pytest.param({"title": "X", "status": "maybe"}, 422, id="bad-status"),
    ],
)
def test_rejected_screenings(admin, fields, status):
    body = {"starts_at": _at(48), **fields}
    assert admin.post("/api/club/admin/events", json=body).status_code == status


def test_next_is_the_soonest_published_screening(admin):
    _create(admin, title="Later", starts_at=_at(24 * 14))
    soon = _create(admin, title="Soon", starts_at=_at(24 * 3))
    _create(admin, title="Draft", starts_at=_at(24), status="draft")
    _create(admin, title="Long gone", starts_at=_at(-24 * 7))
    assert admin.get("/api/club/next").json()["screening"]["id"] == soon["id"]
    schedule = admin.get("/api/club/schedule").json()["screenings"]
    assert [s["title"] for s in schedule] == ["Soon", "Later"]
    assert "status" not in schedule[0]


def test_tonights_screening_stays_up_while_it_plays(admin):
    tonight = _create(admin, title="Tonight", starts_at=_at(-1))
    assert admin.get("/api/club/next").json()["screening"]["id"] == tonight["id"]


def test_nothing_scheduled(api):
    assert api.get("/api/club/next").json() == {"screening": None}
    assert api.get("/api/club/schedule").json() == {"screenings": []}


def test_update_and_delete(admin):
    screening = _create(admin, item_id="m2")
    changed = admin.post(
        f"/api/club/admin/events/{screening['id']}",
        json={"item_id": "m2", "starts_at": _at(72), "status": "draft", "location": "Garage"},
    ).json()["screening"]
    assert (changed["location"], changed["status"]) == ("Garage", "draft")
    assert admin.get("/api/club/next").json() == {"screening": None}
    listed = admin.get("/api/club/admin/events").json()["screenings"]
    assert [s["id"] for s in listed] == [screening["id"]]
    assert admin.post(f"/api/club/admin/events/{screening['id']}/delete").json() == {
        "deleted": screening["id"]
    }
    assert admin.get("/api/club/admin/events").json() == {"screenings": []}


@pytest.mark.parametrize(
    ("method", "path"),
    [
        pytest.param("post", "/api/club/admin/events/999", id="update"),
        pytest.param("post", "/api/club/admin/events/999/delete", id="delete"),
    ],
)
def test_missing_screening(admin, method, path):
    body = {"title": "X", "starts_at": _at(1)}
    assert getattr(admin, method)(path, json=body).status_code == 404


@pytest.mark.parametrize(
    "credentials",
    [pytest.param(None, id="signed-out"), pytest.param(MEMBER, id="member")],
)
def test_only_admins_manage_screenings(api, credentials):
    api.post("/api/club/login", json=credentials) if credentials else None
    body = {"title": "X", "starts_at": _at(1)}
    assert api.get("/api/club/admin/events").status_code in {401, 403}
    assert api.post("/api/club/admin/events", json=body).status_code in {401, 403}


def test_a_film_without_a_poster_still_saves(admin):
    screening = _create(admin, item_id="m3")
    assert (screening["title"], screening["poster_url"]) == ("No Poster", None)


@pytest.mark.parametrize(
    "replacement",
    [
        pytest.param({"item_id": "m3"}, id="library-film-without-art"),
        pytest.param({"title": "Paris, Texas"}, id="typed-film-without-link"),
    ],
)
def test_changing_the_film_drops_the_old_poster(admin, replacement):
    screening = _create(admin, item_id="m1")
    changed = admin.post(
        f"/api/club/admin/events/{screening['id']}",
        json={"starts_at": _at(48), "status": "published", **replacement},
    ).json()["screening"]
    assert changed["poster_url"] is None


def test_an_edit_keeps_a_typed_poster_without_refetching(admin, mocker):
    cache = mocker.patch("criterion.club.art.cache_url", mocker.AsyncMock(return_value="v1"))
    body = {"title": "Paris, Texas", "art_url": "https://img.example/p.jpg", "starts_at": _at(48)}
    screening = _create(admin, **body)
    changed = admin.post(
        f"/api/club/admin/events/{screening['id']}", json={**body, "location": "Garage"}
    ).json()["screening"]
    assert changed["poster_url"] == "/api/club-art/v1.webp"
    assert cache.await_count == 1


def test_an_unreachable_emby_blocks_a_library_screening(admin, fake_emby):
    fake_emby.down = True
    body = {"starts_at": _at(48), "item_id": "m1"}
    assert admin.post("/api/club/admin/events", json=body).status_code == 502


def test_a_screening_keeps_showing_when_emby_goes_away(admin, fake_emby):
    _create(admin, item_id="m1")
    fake_emby.down = True
    screening = admin.get("/api/club/next").json()["screening"]
    assert (screening["title"], screening["runtime_min"]) == ("There Will Be Blood", 158)
    assert screening["poster_url"].startswith("/api/club-art/")


def test_past_screenings_are_published_ones_newest_first(admin):
    _create(admin, title="Upcoming", starts_at=_at(48))
    _create(admin, title="Still showing", starts_at=_at(-1))
    older = _create(admin, title="Older", starts_at=_at(-24 * 60))
    newer = _create(admin, title="Newer", starts_at=_at(-24 * 30))
    _create(admin, title="Never shown", starts_at=_at(-24 * 10), status="draft")
    _create(admin, title="Called off", starts_at=_at(-24 * 20), status="cancelled")
    past = admin.get("/api/club/past").json()["screenings"]
    assert [s["id"] for s in past] == [newer["id"], older["id"]]


def test_past_screenings_show_only_public_fields(admin):
    _create(admin, item_id="m1", starts_at=_at(-24 * 7), message="Bring snacks")
    admin.post("/api/club/logout")
    (screening,) = admin.get("/api/club/past").json()["screenings"]
    assert set(screening) == {"id", "title", "year", "starts_at", "item_id", "poster_url"}
    assert screening["poster_url"].startswith("/api/club-art/")


@pytest.mark.parametrize(
    ("limit", "status"),
    [
        pytest.param(1, 200, id="smallest"),
        pytest.param(0, 422, id="zero"),
        pytest.param(61, 422, id="too-many"),
    ],
)
def test_past_limit_is_bounded(api, limit, status):
    assert api.get(f"/api/club/past?limit={limit}").status_code == status
