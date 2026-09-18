import pytest

from criterion.club import rsvps
from criterion.club.sessions import Session


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param("  Daniel   Plainview ", "Daniel Plainview", id="squeezes-spaces"),
        pytest.param("Eli", "Eli", id="unchanged"),
        pytest.param("   ", "", id="blank"),
    ],
)
def test_tidy_name(raw, expected):
    assert rsvps.tidy_name(raw) == expected


@pytest.mark.parametrize(
    ("session", "name", "expected"),
    [
        pytest.param(Session("u1", "Ryan", 0), "anything", "user:u1", id="signed-in"),
        pytest.param(None, "  Daniel  PLAINVIEW", "name:daniel plainview", id="typed-name"),
    ],
)
def test_person_key(session, name, expected):
    assert rsvps.person_key(session, name) == expected


def test_totals_default_to_zero():
    assert rsvps.totals(None) == {"going": 0, "maybe": 0, "declined": 0, "guests": 0}


def test_totals_read_the_counts():
    row = {"going": 3, "maybe": 1, "declined": None, "guests": 2}
    assert rsvps.totals(row) == {"going": 3, "maybe": 1, "declined": 0, "guests": 2}


@pytest.mark.parametrize(
    ("overrides", "thumb"),
    [
        pytest.param(
            {"item_id": "m1", "art_version": "abc123"},
            "/api/club-art/abc123-t.webp",
            id="library",
        ),
        pytest.param({"item_id": "m3", "art_version": None}, None, id="no-poster"),
        pytest.param({}, None, id="typed"),
    ],
)
def test_admin_suggestion_thumb(overrides, thumb):
    row = {
        "id": 1,
        "item_id": None,
        "art_version": None,
        "title": "Magnolia",
        "year": 1999,
        "name": "Eli",
        "emby_user_id": None,
        "note": None,
        "status": "new",
        "created_at": "2026-09-16T00:00:00+00:00",
        **overrides,
    }
    shaped = rsvps.admin_suggestion(row)
    assert shaped["thumb_url"] == thumb
    assert shaped["signed_in"] is False
