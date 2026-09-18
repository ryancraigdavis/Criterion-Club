import pytest

ADMIN = {"username": "ryan", "password": "projector"}
MEMBER = {"username": "guest", "password": ""}
BROWSER = "browser-id-0123456789"
OTHER_BROWSER = "browser-id-9876543210"


def _as(api, credentials) -> None:
    api.post("/api/club/logout")
    api.post("/api/club/login", json=credentials) if credentials else None


def _poll(api, options=None, question="What next month?") -> dict:
    _as(api, ADMIN)
    body = {
        "question": question,
        "options": options or [{"item_id": "m1"}, {"title": "Paris, Texas", "year": 1984}],
    }
    response = api.post("/api/club/admin/polls", json=body)
    assert response.status_code == 201, response.text
    return response.json()["poll"]


def _move(api, poll_id: int, status: str):
    _as(api, ADMIN)
    return api.post(f"/api/club/admin/polls/{poll_id}/status", json={"status": status})


@pytest.fixture
def ready(api):
    return api


def test_no_poll(ready):
    assert ready.get("/api/club/poll").json() == {"poll": None}


def test_admin_builds_a_poll_from_every_source(ready):
    _as(ready, None)
    ready.post("/api/club/suggestions", json={"item_id": "m2", "name": "Eli"})
    _as(ready, ADMIN)
    suggestion_id = ready.get("/api/club/admin/suggestions").json()["suggestions"][0]["id"]
    poll = _poll(
        ready,
        [
            {"suggestion_id": suggestion_id},
            {"item_id": "m1"},
            {"title": " Paris, Texas ", "year": 1984},
        ],
    )
    assert poll["status"] == "draft"
    assert [(o["title"], o["year"], o["suggestion_id"]) for o in poll["options"]] == [
        ("Clerks", 1994, suggestion_id),
        ("There Will Be Blood", 2007, None),
        ("Paris, Texas", 1984, None),
    ]


@pytest.mark.parametrize(
    "options",
    [
        pytest.param([{"item_id": "m1"}], id="one-option"),
        pytest.param([{"title": f"Film {i}"} for i in range(7)], id="seven-options"),
        pytest.param([{"item_id": "m1"}, {"item_id": "m1"}], id="duplicate-film"),
        pytest.param([{"title": "Paris"}, {"title": "PARIS"}], id="duplicate-title"),
        pytest.param([{"item_id": "nope"}, {"title": "X"}], id="unknown-film"),
        pytest.param([{"suggestion_id": 999}, {"title": "X"}], id="missing-suggestion"),
    ],
)
def test_bad_options(ready, options):
    _as(ready, ADMIN)
    body = {"question": "Which?", "options": options}
    assert ready.post("/api/club/admin/polls", json=body).status_code == 422


def test_drafts_are_not_public(ready):
    _poll(ready)
    _as(ready, None)
    assert ready.get("/api/club/poll").json() == {"poll": None}


def test_voting_on_an_open_poll(ready):
    poll = _poll(ready)
    _move(ready, poll["id"], "open")
    _as(ready, None)
    first, second = (option["id"] for option in poll["options"])
    public = ready.get(f"/api/club/poll?voter={BROWSER}").json()["poll"]
    assert (public["status"], public["my_vote"], public["total_votes"]) == ("open", None, None)
    vote = {"poll_id": poll["id"], "option_id": first, "voter": BROWSER}
    assert ready.post("/api/club/votes", json=vote).json() == {"my_vote": first}
    assert ready.post("/api/club/votes", json={**vote, "option_id": second}).json() == {
        "my_vote": second
    }
    assert ready.get(f"/api/club/poll?voter={BROWSER}").json()["poll"]["my_vote"] == second
    assert ready.get(f"/api/club/poll?voter={OTHER_BROWSER}").json()["poll"]["my_vote"] is None
    assert all(
        option["votes"] is None for option in ready.get("/api/club/poll").json()["poll"]["options"]
    )
    _as(ready, ADMIN)
    counts = ready.get("/api/club/admin/polls").json()["polls"][0]
    assert [o["votes"] for o in counts["options"]] == [0, 1]
    assert counts["total_votes"] == 1


def test_signed_in_votes_count_once_per_account(ready):
    poll = _poll(ready)
    _move(ready, poll["id"], "open")
    _as(ready, MEMBER)
    option = poll["options"][0]["id"]
    for browser in (BROWSER, OTHER_BROWSER):
        ready.post(
            "/api/club/votes", json={"poll_id": poll["id"], "option_id": option, "voter": browser}
        )
    assert ready.get("/api/club/poll").json()["poll"]["my_vote"] == option
    _as(ready, ADMIN)
    shaped = ready.get("/api/club/admin/polls").json()["polls"][0]
    assert (shaped["total_votes"], shaped["options"][0]["voters"]) == (1, ["Guest"])


@pytest.mark.parametrize(
    ("change", "status"),
    [
        pytest.param({"voter": None}, 422, id="no-voter-id"),
        pytest.param({"option_id": 9999}, 422, id="foreign-option"),
        pytest.param({"poll_id": 9999}, 404, id="missing-poll"),
    ],
)
def test_rejected_votes(ready, change, status):
    poll = _poll(ready)
    _move(ready, poll["id"], "open")
    _as(ready, None)
    vote = {
        "poll_id": poll["id"],
        "option_id": poll["options"][0]["id"],
        "voter": BROWSER,
        **change,
    }
    assert ready.post("/api/club/votes", json=vote).status_code == status


def test_closed_polls_show_results_then_age_out(ready):
    poll = _poll(ready)
    _move(ready, poll["id"], "open")
    _as(ready, None)
    option = poll["options"][1]["id"]
    ready.post(
        "/api/club/votes", json={"poll_id": poll["id"], "option_id": option, "voter": BROWSER}
    )
    assert _move(ready, poll["id"], "closed").status_code == 200
    _as(ready, None)
    closed = ready.post(
        "/api/club/votes", json={"poll_id": poll["id"], "option_id": option, "voter": BROWSER}
    )
    assert closed.status_code == 404
    public = ready.get("/api/club/poll").json()["poll"]
    assert ([o["votes"] for o in public["options"]], public["total_votes"]) == ([0, 1], 1)
    conn = ready.app.state.conn
    with conn:
        conn.execute("UPDATE club_polls SET closed_at = '2020-01-01T00:00:00+00:00'")
    assert ready.get("/api/club/poll").json() == {"poll": None}


def test_status_rules(ready):
    first = _poll(ready, question="First")
    second = _poll(ready, question="Second")
    assert _move(ready, first["id"], "closed").status_code == 409
    assert _move(ready, first["id"], "open").status_code == 200
    assert _move(ready, second["id"], "open").json() == {"detail": "another poll is already open"}
    body = {"question": "Edited", "options": [{"item_id": "m1"}, {"item_id": "m2"}]}
    assert ready.post(f"/api/club/admin/polls/{first['id']}", json=body).status_code == 409
    edited = ready.post(f"/api/club/admin/polls/{second['id']}", json=body).json()["poll"]
    assert (edited["question"], [o["title"] for o in edited["options"]]) == (
        "Edited",
        ["There Will Be Blood", "Clerks"],
    )
    assert _move(ready, first["id"], "closed").status_code == 200
    assert _move(ready, second["id"], "open").status_code == 200
    assert _move(ready, first["id"], "open").status_code == 409


def test_delete_poll(ready):
    poll = _poll(ready)
    assert ready.post(f"/api/club/admin/polls/{poll['id']}/delete").json() == {
        "deleted": poll["id"]
    }
    assert ready.get("/api/club/admin/polls").json() == {"polls": []}
    assert ready.post(f"/api/club/admin/polls/{poll['id']}/delete").status_code == 404


@pytest.mark.parametrize(
    "credentials", [pytest.param(None, id="signed-out"), pytest.param(MEMBER, id="member")]
)
def test_only_admins_manage_polls(ready, credentials):
    _as(ready, credentials)
    body = {"question": "Q", "options": [{"title": "A"}, {"title": "B"}]}
    assert ready.get("/api/club/admin/polls").status_code in {401, 403}
    assert ready.post("/api/club/admin/polls", json=body).status_code in {401, 403}
