import sqlite3
from datetime import UTC, datetime, timedelta

from criterion.club import art

SHOWING_FOR = timedelta(hours=4)


def canonical(moment: datetime) -> str:
    return moment.astimezone(UTC).replace(microsecond=0).isoformat()


def cutoff(now: datetime) -> str:
    return canonical(now - SHOWING_FOR)


def poster_url(row: sqlite3.Row) -> str | None:
    return art.art_url(row["art_version"])


def public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "year": row["year"],
        "starts_at": row["starts_at"],
        "location": row["location"],
        "message": row["message"],
        "description": row["description"],
        "item_id": row["item_id"],
        "poster_url": poster_url(row),
        "runtime_min": row["runtime_min"],
    }


def admin(row: sqlite3.Row) -> dict:
    return {
        **public(row),
        "status": row["status"],
        "art_url": row["art_url"],
        "updated_at": row["updated_at"],
    }
