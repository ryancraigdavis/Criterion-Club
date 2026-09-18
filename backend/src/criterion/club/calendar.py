import sqlite3
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

DEFAULT_LENGTH = timedelta(hours=2)
FOLD_AT = 75
ESCAPES = str.maketrans({"\\": "\\\\", ";": "\\;", ",": "\\,", "\n": "\\n", "\r": ""})


def stamp(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def escape(text: str) -> str:
    return text.translate(ESCAPES)


def _fitting(text: str, limit: int) -> str:
    # The longest prefix whose UTF-8 fits in `limit` bytes, never splitting a character.
    return text.encode()[:limit].decode(errors="ignore")


def fold(line: str) -> list[str]:
    head = _fitting(line, FOLD_AT)
    parts, rest = [head], line[len(head) :]
    while rest:
        piece = _fitting(rest, FOLD_AT - 1)
        parts.append(f" {piece}")
        rest = rest[len(piece) :]
    return parts


def length_of(row: sqlite3.Row) -> timedelta:
    return timedelta(minutes=row["runtime_min"]) if row["runtime_min"] else DEFAULT_LENGTH


def summary(row: sqlite3.Row) -> str:
    return f"Criterion Club: {row['title']}"


def details(row: sqlite3.Row, site_url: str) -> str:
    parts = [row["message"], row["description"], site_url]
    return "\n\n".join(part for part in parts if part)


def event(row: sqlite3.Row, site_url: str, now: datetime) -> str:
    start = datetime.fromisoformat(row["starts_at"])
    host = urlsplit(site_url).hostname or "criterion-club"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Criterion Club//Screenings//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:screening-{row['id']}@{host}",
        f"DTSTAMP:{stamp(now)}",
        f"DTSTART:{stamp(start)}",
        f"DTEND:{stamp(start + length_of(row))}",
        f"SUMMARY:{escape(summary(row))}",
        f"LOCATION:{escape(row['location'] or '')}",
        f"DESCRIPTION:{escape(details(row, site_url))}",
        f"URL:{site_url}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "".join(f"{part}\r\n" for line in lines for part in fold(line))
