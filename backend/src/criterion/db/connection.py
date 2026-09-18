import sqlite3
from pathlib import Path

SCHEMA_PATH = Path(__file__).with_name("schema.sql")
# schema.sql is always the current shape. Append single statements here to bring databases created
# before a change up to it; a fresh database skips them and starts at len(MIGRATIONS).
MIGRATIONS: tuple[str, ...] = ("ALTER TABLE club_events ADD COLUMN trailer_url TEXT",)


def _version(conn: sqlite3.Connection) -> int:
    return conn.execute("PRAGMA user_version").fetchone()[0]


def _is_empty(conn: sqlite3.Connection) -> bool:
    return conn.execute("SELECT count(*) FROM sqlite_master").fetchone()[0] == 0


def migrate(conn: sqlite3.Connection, migrations: tuple[str, ...], start: int) -> None:
    with conn:
        for statement in migrations[start:]:
            conn.execute(statement)
        conn.execute(f"PRAGMA user_version = {len(migrations)}")


def connect(data_dir: Path) -> sqlite3.Connection:
    data_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(data_dir / "club.db", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    start = len(MIGRATIONS) if _is_empty(conn) else _version(conn)
    conn.executescript(SCHEMA_PATH.read_text())
    migrate(conn, MIGRATIONS, start)
    return conn
