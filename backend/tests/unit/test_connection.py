import sqlite3

import pytest

from criterion.db.connection import MIGRATIONS, connect, migrate

STEPS = (
    "ALTER TABLE things ADD COLUMN colour TEXT",
    "ALTER TABLE things ADD COLUMN size INTEGER",
)


@pytest.fixture
def old_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE things (id INTEGER PRIMARY KEY)")
    yield conn
    conn.close()


def _columns(conn: sqlite3.Connection) -> list[str]:
    return [row[1] for row in conn.execute("PRAGMA table_info(things)")]


def _version(conn: sqlite3.Connection) -> int:
    return conn.execute("PRAGMA user_version").fetchone()[0]


def test_a_fresh_database_starts_at_the_latest_version(tmp_path):
    conn = connect(tmp_path)
    assert _version(conn) == len(MIGRATIONS)
    conn.close()


def test_reopening_keeps_the_version(tmp_path):
    connect(tmp_path).close()
    conn = connect(tmp_path)
    assert _version(conn) == len(MIGRATIONS)
    conn.close()


@pytest.mark.parametrize(
    ("start", "expected"),
    [
        pytest.param(0, ["id", "colour", "size"], id="from-scratch"),
        pytest.param(1, ["id", "size"], id="part-way"),
        pytest.param(2, ["id"], id="up-to-date"),
    ],
)
def test_runs_only_the_missing_steps(old_db, start, expected):
    migrate(old_db, STEPS, start)
    assert _columns(old_db) == expected
    assert _version(old_db) == len(STEPS)


def test_a_database_from_before_trailers_gains_the_column(tmp_path):
    old = sqlite3.connect(tmp_path / "club.db")
    old.executescript(
        "CREATE TABLE club_events (id INTEGER PRIMARY KEY, title TEXT NOT NULL,"
        " starts_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',"
        " created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"
        "INSERT INTO club_events VALUES (1, 'Kept', '2026-01-01', 'published', 'x', 'x');"
    )
    old.commit()
    old.close()
    conn = connect(tmp_path)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(club_events)")}
    assert "trailer_url" in columns
    assert conn.execute("SELECT title FROM club_events").fetchone()[0] == "Kept"
    assert _version(conn) == len(MIGRATIONS)
    conn.close()


def test_a_fresh_database_already_has_trailers(tmp_path):
    conn = connect(tmp_path)
    assert "trailer_url" in {row[1] for row in conn.execute("PRAGMA table_info(club_events)")}
    conn.close()
