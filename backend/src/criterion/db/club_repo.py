import sqlite3
from datetime import UTC, datetime

EVENT_FIELDS = (
    "item_id",
    "title",
    "year",
    "runtime_min",
    "art_url",
    "art_version",
    "message",
    "description",
    "starts_at",
    "location",
    "status",
)
_SELECT_EVENT = "SELECT e.* FROM club_events e"


def _now() -> str:
    return datetime.now(UTC).isoformat()


def insert_event(conn: sqlite3.Connection, fields: dict) -> int:
    now = _now()
    columns = ", ".join(EVENT_FIELDS)
    values = ", ".join(f":{name}" for name in EVENT_FIELDS)
    with conn:
        cursor = conn.execute(
            f"INSERT INTO club_events ({columns}, created_at, updated_at) "
            f"VALUES ({values}, :now, :now)",
            {**fields, "now": now},
        )
    return int(cursor.lastrowid)


def update_event(conn: sqlite3.Connection, event_id: int, fields: dict) -> bool:
    assignments = ", ".join(f"{name} = :{name}" for name in EVENT_FIELDS)
    with conn:
        cursor = conn.execute(
            f"UPDATE club_events SET {assignments}, updated_at = :now WHERE id = :id",
            {**fields, "now": _now(), "id": event_id},
        )
    return cursor.rowcount > 0


def delete_event(conn: sqlite3.Connection, event_id: int) -> bool:
    with conn:
        cursor = conn.execute("DELETE FROM club_events WHERE id = ?", (event_id,))
    return cursor.rowcount > 0


def get_event(conn: sqlite3.Connection, event_id: int) -> sqlite3.Row | None:
    return conn.execute(f"{_SELECT_EVENT} WHERE e.id = ?", (event_id,)).fetchone()


def list_events(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(f"{_SELECT_EVENT} ORDER BY e.starts_at DESC, e.id DESC").fetchall()


def upcoming_events(conn: sqlite3.Connection, since: str, limit: int) -> list[sqlite3.Row]:
    return conn.execute(
        f"{_SELECT_EVENT} WHERE e.status = 'published' AND e.starts_at >= ? "
        "ORDER BY e.starts_at, e.id LIMIT ?",
        (since, limit),
    ).fetchall()


def upsert_rsvp(conn: sqlite3.Connection, fields: dict) -> None:
    with conn:
        conn.execute(
            "INSERT INTO club_rsvps "
            "(event_id, person, name, emby_user_id, answer, guests, note, created_at, updated_at) "
            "VALUES (:event_id, :person, :name, :emby_user_id, :answer, :guests, :note, "
            ":now, :now) "
            "ON CONFLICT(event_id, person) DO UPDATE SET name=excluded.name, "
            "emby_user_id=excluded.emby_user_id, answer=excluded.answer, "
            "guests=excluded.guests, note=excluded.note, updated_at=excluded.updated_at",
            {**fields, "now": _now()},
        )


def rsvp_for(conn: sqlite3.Connection, event_id: int, person: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM club_rsvps WHERE event_id = ? AND person = ?", (event_id, person)
    ).fetchone()


def list_rsvps(conn: sqlite3.Connection, event_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM club_rsvps WHERE event_id = ? ORDER BY "
        "CASE answer WHEN 'yes' THEN 0 WHEN 'maybe' THEN 1 ELSE 2 END, lower(name)",
        (event_id,),
    ).fetchall()


def rsvp_counts(conn: sqlite3.Connection) -> dict[int, sqlite3.Row]:
    rows = conn.execute(
        "SELECT event_id, SUM(answer = 'yes') AS going, SUM(answer = 'maybe') AS maybe, "
        "SUM(answer = 'no') AS declined, "
        "SUM(CASE WHEN answer = 'yes' THEN guests ELSE 0 END) AS guests "
        "FROM club_rsvps GROUP BY event_id"
    ).fetchall()
    return {row["event_id"]: row for row in rows}


def delete_rsvp(conn: sqlite3.Connection, rsvp_id: int) -> bool:
    with conn:
        cursor = conn.execute("DELETE FROM club_rsvps WHERE id = ?", (rsvp_id,))
    return cursor.rowcount > 0


def delete_event_rsvps(conn: sqlite3.Connection, event_id: int) -> None:
    with conn:
        conn.execute("DELETE FROM club_rsvps WHERE event_id = ?", (event_id,))


def insert_suggestion(conn: sqlite3.Connection, fields: dict) -> int:
    with conn:
        cursor = conn.execute(
            "INSERT INTO club_suggestions (item_id, title, year, art_version, name, "
            "emby_user_id, note, status, created_at, updated_at) "
            "VALUES (:item_id, :title, :year, :art_version, :name, :emby_user_id, :note, "
            "'new', :now, :now)",
            {**fields, "now": _now()},
        )
    return int(cursor.lastrowid)


def list_suggestions(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT s.* FROM club_suggestions s ORDER BY s.created_at DESC, s.id DESC"
    ).fetchall()


def set_suggestion_status(conn: sqlite3.Connection, suggestion_id: int, status: str) -> bool:
    with conn:
        cursor = conn.execute(
            "UPDATE club_suggestions SET status = ?, updated_at = ? WHERE id = ?",
            (status, _now(), suggestion_id),
        )
    return cursor.rowcount > 0


def delete_suggestion(conn: sqlite3.Connection, suggestion_id: int) -> bool:
    with conn:
        cursor = conn.execute("DELETE FROM club_suggestions WHERE id = ?", (suggestion_id,))
    return cursor.rowcount > 0
