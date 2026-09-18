import sqlite3
from datetime import UTC, datetime

_SELECT_OPTIONS = "SELECT o.* FROM club_poll_options o"


def _now() -> str:
    return datetime.now(UTC).isoformat()


def insert_poll(conn: sqlite3.Connection, question: str, options: list[dict]) -> int:
    now = _now()
    with conn:
        cursor = conn.execute(
            "INSERT INTO club_polls (question, status, created_at, updated_at) "
            "VALUES (?, 'draft', ?, ?)",
            (question, now, now),
        )
        poll_id = int(cursor.lastrowid)
        _write_options(conn, poll_id, options)
    return poll_id


def replace_poll(
    conn: sqlite3.Connection, poll_id: int, question: str, options: list[dict]
) -> None:
    with conn:
        conn.execute(
            "UPDATE club_polls SET question = ?, updated_at = ? WHERE id = ?",
            (question, _now(), poll_id),
        )
        conn.execute("DELETE FROM club_poll_options WHERE poll_id = ?", (poll_id,))
        _write_options(conn, poll_id, options)


def _write_options(conn: sqlite3.Connection, poll_id: int, options: list[dict]) -> None:
    conn.executemany(
        "INSERT INTO club_poll_options "
        "(poll_id, position, item_id, title, year, art_version, suggestion_id) "
        "VALUES (:poll_id, :position, :item_id, :title, :year, :art_version, :suggestion_id)",
        [{**option, "poll_id": poll_id, "position": i} for i, option in enumerate(options)],
    )


def set_status(conn: sqlite3.Connection, poll_id: int, status: str) -> None:
    now = _now()
    closed_at = now if status == "closed" else None
    with conn:
        conn.execute(
            "UPDATE club_polls SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?",
            (status, closed_at, now, poll_id),
        )


def delete_poll(conn: sqlite3.Connection, poll_id: int) -> None:
    with conn:
        conn.execute("DELETE FROM club_votes WHERE poll_id = ?", (poll_id,))
        conn.execute("DELETE FROM club_poll_options WHERE poll_id = ?", (poll_id,))
        conn.execute("DELETE FROM club_polls WHERE id = ?", (poll_id,))


def get_poll(conn: sqlite3.Connection, poll_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM club_polls WHERE id = ?", (poll_id,)).fetchone()


def list_polls(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM club_polls ORDER BY created_at DESC, id DESC").fetchall()


def open_poll(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM club_polls WHERE status = 'open' ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()


def recent_closed_poll(conn: sqlite3.Connection, since: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM club_polls WHERE status = 'closed' AND closed_at >= ? "
        "ORDER BY closed_at DESC LIMIT 1",
        (since,),
    ).fetchone()


def options_for(conn: sqlite3.Connection, poll_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        f"{_SELECT_OPTIONS} WHERE o.poll_id = ? ORDER BY o.position", (poll_id,)
    ).fetchall()


def vote_counts(conn: sqlite3.Connection, poll_id: int) -> dict[int, int]:
    rows = conn.execute(
        "SELECT option_id, COUNT(*) AS votes FROM club_votes WHERE poll_id = ? GROUP BY option_id",
        (poll_id,),
    ).fetchall()
    return {row["option_id"]: row["votes"] for row in rows}


def named_voters(conn: sqlite3.Connection, poll_id: int) -> dict[int, list[str]]:
    rows = conn.execute(
        "SELECT option_id, name FROM club_votes WHERE poll_id = ? AND name IS NOT NULL "
        "ORDER BY lower(name)",
        (poll_id,),
    ).fetchall()
    names: dict[int, list[str]] = {}
    for row in rows:
        names.setdefault(row["option_id"], []).append(row["name"])
    return names


def vote_for(conn: sqlite3.Connection, poll_id: int, voter: str) -> int | None:
    row = conn.execute(
        "SELECT option_id FROM club_votes WHERE poll_id = ? AND voter = ?", (poll_id, voter)
    ).fetchone()
    return row["option_id"] if row else None


def cast_vote(conn: sqlite3.Connection, fields: dict) -> None:
    with conn:
        conn.execute(
            "INSERT INTO club_votes (poll_id, option_id, voter, name, created_at, updated_at) "
            "VALUES (:poll_id, :option_id, :voter, :name, :now, :now) "
            "ON CONFLICT(poll_id, voter) DO UPDATE SET option_id = excluded.option_id, "
            "name = excluded.name, updated_at = excluded.updated_at",
            {**fields, "now": _now()},
        )


def suggestion(conn: sqlite3.Connection, suggestion_id: int) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT id, item_id, title, year, art_version FROM club_suggestions WHERE id = ?",
        (suggestion_id,),
    ).fetchone()
