import sqlite3

from criterion.club import art
from criterion.club.sessions import Session


def tidy_name(name: str) -> str:
    return " ".join(name.split())


def person_key(session: Session | None, name: str) -> str:
    return f"user:{session.uid}" if session else f"name:{tidy_name(name).casefold()}"


def echo(row: sqlite3.Row) -> dict:
    return {
        "name": row["name"],
        "answer": row["answer"],
        "guests": row["guests"],
        "note": row["note"],
    }


def admin_rsvp(row: sqlite3.Row) -> dict:
    return {
        **echo(row),
        "id": row["id"],
        "signed_in": row["emby_user_id"] is not None,
        "updated_at": row["updated_at"],
    }


def totals(row: sqlite3.Row | None) -> dict:
    keys = ("going", "maybe", "declined", "guests")
    return {key: int((row[key] if row else 0) or 0) for key in keys}


def admin_suggestion(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "item_id": row["item_id"],
        "title": row["title"],
        "year": row["year"],
        "name": row["name"],
        "signed_in": row["emby_user_id"] is not None,
        "note": row["note"],
        "status": row["status"],
        "created_at": row["created_at"],
        "thumb_url": art.art_url(row["art_version"], art.THUMB),
    }
