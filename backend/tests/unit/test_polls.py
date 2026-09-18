import pytest

from criterion.club import polls
from criterion.club.sessions import Session

BROWSER = "a" * 24


@pytest.mark.parametrize(
    ("session", "browser", "expected"),
    [
        pytest.param(Session("u1", "Ryan", 0), None, "user:u1", id="signed-in"),
        pytest.param(Session("u1", "Ryan", 0), BROWSER, "user:u1", id="account-beats-browser"),
        pytest.param(None, BROWSER, f"browser:{BROWSER}", id="browser"),
    ],
)
def test_voter_key(session, browser, expected):
    assert polls.voter_key(session, browser) == expected


@pytest.mark.parametrize(
    "browser",
    [
        pytest.param(None, id="missing"),
        pytest.param("short", id="too-short"),
        pytest.param("x" * 16 + "!", id="bad-characters"),
    ],
)
def test_voter_key_needs_a_real_browser_id(browser):
    with pytest.raises(polls.VoterProblem):
        polls.voter_key(None, browser)


@pytest.mark.parametrize(
    ("current", "target", "allowed"),
    [
        pytest.param("draft", "open", True, id="open-draft"),
        pytest.param("open", "closed", True, id="close"),
        pytest.param("closed", "open", True, id="reopen"),
        pytest.param("draft", "closed", False, id="close-draft"),
        pytest.param("open", "open", False, id="reopen-open"),
    ],
)
def test_can_move(current, target, allowed):
    assert polls.can_move(current, target) is allowed


@pytest.mark.parametrize(
    ("option", "expected"),
    [
        pytest.param({"item_id": "m1", "title": "X", "year": 1}, "m1", id="library"),
        pytest.param(
            {"item_id": None, "title": "Paris, TEXAS", "year": 1984},
            "paris, texas|1984",
            id="typed",
        ),
    ],
)
def test_option_key(option, expected):
    assert polls.option_key(option) == expected


def _poll(status: str) -> dict:
    return {
        "id": 1,
        "question": "Next month?",
        "status": status,
        "closed_at": None,
        "created_at": "t",
    }


OPTIONS = [
    {
        "id": 10,
        "item_id": "m1",
        "art_version": "abc123",
        "title": "Blood",
        "year": 2007,
        "suggestion_id": 4,
    },
    {
        "id": 11,
        "item_id": None,
        "art_version": None,
        "title": "Paris",
        "year": 1984,
        "suggestion_id": None,
    },
]


def test_open_polls_hide_the_count():
    shaped = polls.public_poll(_poll("open"), OPTIONS, {10: 3, 11: 1}, 11)
    assert [option["votes"] for option in shaped["options"]] == [None, None]
    assert shaped["total_votes"] is None
    assert shaped["my_vote"] == 11
    assert shaped["options"][0]["thumb_url"] == "/api/club-art/abc123-t.webp"


def test_closed_polls_show_results():
    shaped = polls.public_poll(_poll("closed"), OPTIONS, {10: 3}, None)
    assert [option["votes"] for option in shaped["options"]] == [3, 0]
    assert shaped["total_votes"] == 3


def test_admins_always_see_counts_and_names():
    shaped = polls.admin_poll(_poll("open"), OPTIONS, {10: 2, 11: 1}, {10: ["Ryan"]})
    assert [(o["votes"], o["voters"], o["suggestion_id"]) for o in shaped["options"]] == [
        (2, ["Ryan"], 4),
        (1, [], None),
    ]
    assert shaped["total_votes"] == 3
