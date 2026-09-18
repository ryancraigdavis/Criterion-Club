import pytest

from criterion.club import sessions
from criterion.club.sessions import Session

SECRET = "s3cret"
NOW = 1_800_000_000.0


@pytest.fixture
def token() -> str:
    return sessions.issue("uid-1", "Ryan", SECRET, NOW, ttl=3600)


def test_round_trip(token):
    assert sessions.read(token, SECRET, NOW + 10) == Session("uid-1", "Ryan", int(NOW) + 3600)


@pytest.mark.parametrize(
    ("mangle", "secret", "at"),
    [
        pytest.param(lambda t: t, "other-secret", NOW, id="wrong-secret"),
        pytest.param(lambda t: t, "", NOW, id="no-secret"),
        pytest.param(lambda t: t, SECRET, NOW + 3600, id="expired"),
        pytest.param(lambda t: t[:-2] + "xx", SECRET, NOW, id="tampered-tag"),
        pytest.param(lambda t: "e30" + t[3:], SECRET, NOW, id="tampered-body"),
        pytest.param(lambda t: "", SECRET, NOW, id="empty"),
        pytest.param(lambda t: "not-a-token", SECRET, NOW, id="garbage"),
    ],
)
def test_rejects(token, mangle, secret, at):
    with pytest.raises(ValueError):
        sessions.read(mangle(token), secret, at)


def test_signed_but_malformed_payload_is_rejected():
    body = sessions._encode(b'{"uid": "x"}')
    forged = f"{body}.{sessions._tag(body, SECRET)}"
    with pytest.raises(ValueError, match="malformed"):
        sessions.read(forged, SECRET, NOW)


@pytest.mark.parametrize(
    ("session", "expected"),
    [
        pytest.param(Session("1", "Ryan", 0), True, id="listed"),
        pytest.param(Session("1", "RYAN", 0), True, id="case-insensitive"),
        pytest.param(Session("2", "Guest", 0), False, id="not-listed"),
        pytest.param(None, False, id="signed-out"),
    ],
)
def test_is_admin(session, expected):
    assert sessions.is_admin(session, frozenset({"ryan", "co-host"})) is expected
