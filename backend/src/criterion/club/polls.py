import re
import sqlite3
from datetime import datetime, timedelta

from criterion.club import art
from criterion.club.sessions import Session

RESULTS_FOR = timedelta(days=14)
MIN_OPTIONS = 2
MAX_OPTIONS = 6
BROWSER_ID = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
TRANSITIONS = {("draft", "open"), ("open", "closed"), ("closed", "open")}


class VoterProblem(ValueError):
    pass


def voter_key(session: Session | None, browser_id: str | None) -> str:
    usable = session is not None or bool(browser_id and BROWSER_ID.match(browser_id))
    if not usable:
        raise VoterProblem("this browser has no voter id")
    return f"user:{session.uid}" if session else f"browser:{browser_id}"


def results_since(now: datetime) -> str:
    return (now - RESULTS_FOR).isoformat()


def can_move(current: str, target: str) -> bool:
    return (current, target) in TRANSITIONS


def option_key(option: dict) -> str:
    return option["item_id"] or f"{option['title'].casefold()}|{option['year']}"


def thumb_url(row: sqlite3.Row) -> str | None:
    return art.art_url(row["art_version"], art.THUMB)


def _option(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "item_id": row["item_id"],
        "title": row["title"],
        "year": row["year"],
        "thumb_url": thumb_url(row),
    }


def public_poll(
    poll: sqlite3.Row, options: list[sqlite3.Row], counts: dict[int, int], mine: int | None
) -> dict:
    closed = poll["status"] == "closed"
    return {
        "id": poll["id"],
        "question": poll["question"],
        "status": poll["status"],
        "options": [
            {**_option(row), "votes": counts.get(row["id"], 0) if closed else None}
            for row in options
        ],
        "total_votes": sum(counts.values()) if closed else None,
        "my_vote": mine,
    }


def admin_poll(
    poll: sqlite3.Row,
    options: list[sqlite3.Row],
    counts: dict[int, int],
    names: dict[int, list[str]],
) -> dict:
    return {
        "id": poll["id"],
        "question": poll["question"],
        "status": poll["status"],
        "closed_at": poll["closed_at"],
        "created_at": poll["created_at"],
        "options": [
            {
                **_option(row),
                "suggestion_id": row["suggestion_id"],
                "votes": counts.get(row["id"], 0),
                "voters": names.get(row["id"], []),
            }
            for row in options
        ],
        "total_votes": sum(counts.values()),
    }
