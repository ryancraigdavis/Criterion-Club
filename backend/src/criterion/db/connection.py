import sqlite3
from pathlib import Path

SCHEMA_PATH = Path(__file__).with_name("schema.sql")
ADDED_COLUMNS = {
    "club_events": {"runtime_min": "INTEGER"},
    "club_suggestions": {"art_version": "TEXT"},
    "club_poll_options": {"art_version": "TEXT"},
}


def _add_missing(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    missing = {name: kind for name, kind in columns.items() if name not in existing}
    for name, kind in missing.items():
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")


def connect(data_dir: Path) -> sqlite3.Connection:
    data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(data_dir / "club.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA_PATH.read_text())
    with conn:
        for table, columns in ADDED_COLUMNS.items():
            _add_missing(conn, table, columns)
    return conn
