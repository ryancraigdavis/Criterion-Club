import sqlite3
from datetime import UTC, datetime

import pytest

from criterion.club import calendar

SITE = "https://criterion.example.com"
NOW = datetime(2026, 9, 18, 12, 0, tzinfo=UTC)


@pytest.fixture
def row():
    def make(**fields) -> sqlite3.Row:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        values = {
            "id": 7,
            "title": "Seven Samurai",
            "starts_at": "2026-09-25T02:00:00+00:00",
            "runtime_min": 207,
            "location": "The basement",
            "message": "Bring a cushion.",
            "description": "A village hires samurai.",
            **fields,
        }
        columns = ", ".join(f":{name} AS {name}" for name in values)
        return conn.execute(f"SELECT {columns}", values).fetchone()

    return make


def _lines(text: str) -> dict[str, str]:
    unfolded = text.replace("\r\n ", "")
    return dict(line.split(":", 1) for line in unfolded.split("\r\n") if ":" in line)


def test_times_are_utc_and_end_after_the_runtime(row):
    lines = _lines(calendar.event(row(), SITE, NOW))
    assert (lines["DTSTART"], lines["DTEND"]) == ("20260925T020000Z", "20260925T052700Z")
    assert lines["DTSTAMP"] == "20260918T120000Z"


def test_an_unknown_runtime_lasts_two_hours(row):
    lines = _lines(calendar.event(row(runtime_min=None), SITE, NOW))
    assert lines["DTEND"] == "20260925T040000Z"


def test_the_event_names_the_club_and_the_screening(row):
    lines = _lines(calendar.event(row(), SITE, NOW))
    assert lines["UID"] == "screening-7@criterion.example.com"
    assert lines["SUMMARY"] == "Criterion Club: Seven Samurai"
    assert lines["DESCRIPTION"] == (
        "Bring a cushion.\\n\\nA village hires samurai.\\n\\nhttps://criterion.example.com"
    )


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        pytest.param("Paris, Texas", "Paris\\, Texas", id="comma"),
        pytest.param("a;b", r"a\;b", id="semicolon"),
        pytest.param("back\\slash", "back\\\\slash", id="backslash"),
        pytest.param("two\r\nlines", "two\\nlines", id="newline"),
    ],
)
def test_text_is_escaped(text, expected):
    assert calendar.escape(text) == expected


def test_every_line_ends_with_crlf_and_fits(row):
    long = "Très long message — " * 20
    text = calendar.event(row(message=long), SITE, NOW)
    lines = text.split("\r\n")
    assert text.endswith("\r\n")
    assert all(len(line.encode()) <= calendar.FOLD_AT for line in lines)


@pytest.mark.parametrize(
    "line",
    [
        pytest.param("x" * 200, id="ascii"),
        pytest.param("é" * 120, id="two-byte"),
        pytest.param("🎬" * 60, id="four-byte"),
    ],
)
def test_folding_never_splits_a_character(line):
    parts = calendar.fold(line)
    assert "".join(part.removeprefix(" ") for part in parts) == line
    assert all(len(part.encode()) <= calendar.FOLD_AT for part in parts)
    assert all(part.startswith(" ") for part in parts[1:])
