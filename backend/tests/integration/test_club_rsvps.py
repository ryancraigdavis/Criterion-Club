from datetime import UTC, datetime, timedelta

import pytest

ADMIN = {"username": "ryan", "password": "projector"}
MEMBER = {"username": "guest", "password": ""}


def _at(hours: float) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def _screening(api, **fields) -> int:
    api.post("/api/club/login", json=ADMIN)
    body = {"title": "Magnolia", "starts_at": _at(48), "status": "published", **fields}
    event_id = api.post("/api/club/admin/events", json=body).json()["screening"]["id"]
    api.post("/api/club/logout")
    return event_id


@pytest.fixture
def screening(api) -> int:
    return _screening(api)


def _rsvp(api, event_id: int, **fields):
    return api.post("/api/club/rsvp", json={"event_id": event_id, "answer": "yes", **fields})


def _guest_list(api, event_id: int) -> dict:
    api.post("/api/club/login", json=ADMIN)
    body = api.get(f"/api/club/admin/events/{event_id}/rsvps").json()
    api.post("/api/club/logout")
    return body


def test_anonymous_rsvp_with_a_name(api, screening):
    response = _rsvp(api, screening, name=" Eli  Sunday ", guests=2, note="Bringing a friend")
    assert response.json() == {
        "rsvp": {"name": "Eli Sunday", "answer": "yes", "guests": 2, "note": "Bringing a friend"}
    }


def test_answering_again_updates_instead_of_duplicating(api, screening):
    _rsvp(api, screening, name="Eli Sunday", guests=2)
    changed = _rsvp(api, screening, name="eli   SUNDAY", answer="no", guests=3).json()["rsvp"]
    assert (changed["answer"], changed["guests"]) == ("no", 0)
    listed = _guest_list(api, screening)
    assert len(listed["rsvps"]) == 1
    assert listed["totals"] == {"going": 0, "maybe": 0, "declined": 1, "guests": 0}


def test_signed_in_rsvp_uses_the_account(api, screening):
    api.post("/api/club/login", json=MEMBER)
    assert _rsvp(api, screening, name="Someone Else", answer="maybe").json()["rsvp"]["name"] == (
        "Guest"
    )
    mine = api.get(f"/api/club/rsvp?event_id={screening}").json()
    assert mine["rsvp"]["answer"] == "maybe"
    api.post("/api/club/logout")
    assert api.get(f"/api/club/rsvp?event_id={screening}").json() == {"rsvp": None}


def test_a_name_is_needed_when_signed_out(api, screening):
    assert _rsvp(api, screening, name="   ").status_code == 422


@pytest.mark.parametrize(
    "fields",
    [
        pytest.param({"status": "draft"}, id="draft"),
        pytest.param({"starts_at": "2020-01-01T00:00:00+00:00"}, id="long-past"),
    ],
)
def test_only_open_screenings_take_rsvps(api, fields):
    event_id = _screening(api, **fields)
    assert _rsvp(api, event_id, name="Eli").status_code == 404
    assert _rsvp(api, 9999, name="Eli").status_code == 404


def test_rsvps_stay_private(api, screening):
    _rsvp(api, screening, name="Eli", note="secret")
    public = api.get("/api/club/next").text + api.get("/api/club/schedule").text
    assert "Eli" not in public
    assert "rsvp" not in public
    assert api.get(f"/api/club/admin/events/{screening}/rsvps").status_code == 401
    api.post("/api/club/login", json=MEMBER)
    assert api.get(f"/api/club/admin/events/{screening}/rsvps").status_code == 403


def test_guest_list_orders_and_counts(api, screening):
    _rsvp(api, screening, name="Zed", answer="maybe", guests=1)
    _rsvp(api, screening, name="Abe", answer="no")
    _rsvp(api, screening, name="Mo", answer="yes", guests=2)
    _rsvp(api, screening, name="Al", answer="yes")
    listed = _guest_list(api, screening)
    assert [r["name"] for r in listed["rsvps"]] == ["Al", "Mo", "Zed", "Abe"]
    assert listed["totals"] == {"going": 2, "maybe": 1, "declined": 1, "guests": 2}
    api.post("/api/club/login", json=ADMIN)
    rows = api.get("/api/club/admin/events").json()["screenings"]
    assert rows[0]["rsvps"] == listed["totals"]


def test_admin_removes_an_rsvp_and_deleting_a_screening_clears_them(api, screening):
    _rsvp(api, screening, name="Spam Bot")
    rsvp_id = _guest_list(api, screening)["rsvps"][0]["id"]
    api.post("/api/club/login", json=ADMIN)
    assert api.post(f"/api/club/admin/rsvps/{rsvp_id}/delete").json() == {"deleted": rsvp_id}
    assert api.post(f"/api/club/admin/rsvps/{rsvp_id}/delete").status_code == 404
    api.post("/api/club/logout")
    _rsvp(api, screening, name="Eli")
    api.post("/api/club/login", json=ADMIN)
    api.post(f"/api/club/admin/events/{screening}/delete")
    replacement = _screening(api)
    assert replacement != screening
    api.post("/api/club/login", json=ADMIN)
    assert api.get(f"/api/club/admin/events/{screening}/rsvps").status_code == 404


def test_library_suggestion(api):
    response = api.post("/api/club/suggestions", json={"item_id": "m2", "name": "Eli"})
    assert response.status_code == 201
    assert response.json() == {"suggestion": {"title": "Clerks", "year": 1994}}


@pytest.mark.parametrize(
    ("body", "status"),
    [
        pytest.param({"title": "Paris, Texas", "year": 1984, "name": "Eli"}, 201, id="typed"),
        pytest.param({"title": "  ", "name": "Eli"}, 422, id="no-title"),
        pytest.param({"item_id": "nope", "name": "Eli"}, 422, id="unknown-film"),
        pytest.param({"title": "Paris, Texas", "name": ""}, 422, id="no-name"),
        pytest.param({"title": "Paris, Texas", "name": "Eli", "year": 1492}, 422, id="bad-year"),
    ],
)
def test_suggestion_validation(api, body, status):
    assert api.post("/api/club/suggestions", json=body).status_code == status


def test_admin_suggestion_inbox(api):
    api.post("/api/club/suggestions", json={"item_id": "m1", "name": "Eli", "note": "Oil!"})
    api.post("/api/club/login", json=MEMBER)
    api.post("/api/club/suggestions", json={"title": "Paris, Texas", "name": "ignored"})
    assert api.get("/api/club/admin/suggestions").status_code == 403
    api.post("/api/club/login", json=ADMIN)
    inbox = api.get("/api/club/admin/suggestions").json()["suggestions"]
    assert [(s["title"], s["name"], s["signed_in"]) for s in inbox] == [
        ("Paris, Texas", "Guest", True),
        ("There Will Be Blood", "Eli", False),
    ]
    assert inbox[1]["thumb_url"].endswith("-t.webp")
    first = inbox[0]["id"]
    assert api.post(
        f"/api/club/admin/suggestions/{first}", json={"status": "shortlisted"}
    ).json() == {
        "id": first,
        "status": "shortlisted",
    }
    assert (
        api.post(f"/api/club/admin/suggestions/{first}", json={"status": "maybe"}).status_code
        == 422
    )
    assert api.post("/api/club/admin/suggestions/999", json={"status": "new"}).status_code == 404
    assert api.post(f"/api/club/admin/suggestions/{first}/delete").json() == {"deleted": first}
    assert len(api.get("/api/club/admin/suggestions").json()["suggestions"]) == 1


def test_posts_are_rate_limited(api, screening):
    statuses = [_rsvp(api, screening, name=f"Person {i}").status_code for i in range(31)]
    assert statuses[:30] == [200] * 30
    assert statuses[30] == 429


def test_cross_site_rsvp_is_refused(api, screening):
    headers = {"Origin": "https://evil.example"}
    body = {"event_id": screening, "answer": "yes", "name": "Eli"}
    assert api.post("/api/club/rsvp", json=body, headers=headers).status_code == 403
