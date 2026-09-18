import sqlite3
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from criterion.api.deps import (
    conn_of,
    emby_of,
    limit_posts,
    require_admin,
    require_same_site,
    session_of,
    settings_of,
)
from criterion.club import films, polls
from criterion.club.sessions import Session
from criterion.db import poll_repo, repo
from criterion.emby.auth import EmbyUnavailable

router = APIRouter(tags=["club-polls"])

BOARD_SCHEDULE = "club_board_schedule"


class VoteIn(BaseModel):
    poll_id: int
    option_id: int
    voter: str | None = Field(default=None, max_length=64)


class OptionIn(BaseModel):
    item_id: str | None = Field(default=None, max_length=64)
    title: str = Field(default="", max_length=200)
    year: int | None = Field(default=None, ge=1880, le=2100)
    suggestion_id: int | None = None


class PollIn(BaseModel):
    question: str = Field(min_length=1, max_length=200)
    options: list[OptionIn] = Field(min_length=polls.MIN_OPTIONS, max_length=polls.MAX_OPTIONS)


class PollStatusIn(BaseModel):
    status: Literal["open", "closed"]


class SettingsIn(BaseModel):
    board_schedule: bool


def _my_vote(
    conn: sqlite3.Connection, poll_id: int, session: Session | None, voter: str | None
) -> int | None:
    try:
        key = polls.voter_key(session, voter)
    except polls.VoterProblem:
        key = None
    return poll_repo.vote_for(conn, poll_id, key) if key else None


def _public(
    conn: sqlite3.Connection, poll: sqlite3.Row, request: Request, voter: str | None
) -> dict:
    poll_id = poll["id"]
    return polls.public_poll(
        poll,
        poll_repo.options_for(conn, poll_id),
        poll_repo.vote_counts(conn, poll_id),
        _my_vote(conn, poll_id, session_of(request), voter),
    )


def _admin(conn: sqlite3.Connection, poll: sqlite3.Row) -> dict:
    poll_id = poll["id"]
    return polls.admin_poll(
        poll,
        poll_repo.options_for(conn, poll_id),
        poll_repo.vote_counts(conn, poll_id),
        poll_repo.named_voters(conn, poll_id),
    )


def _existing(request: Request, poll_id: int) -> sqlite3.Row:
    poll = poll_repo.get_poll(conn_of(request), poll_id)
    if poll is None:
        raise HTTPException(404, "no such poll")
    return poll


async def _from_suggestion(conn: sqlite3.Connection, _: Request, option: OptionIn) -> dict:
    row = poll_repo.suggestion(conn, option.suggestion_id or 0)
    if row is None:
        raise HTTPException(422, "that suggestion no longer exists")
    return {
        "item_id": row["item_id"],
        "title": row["title"],
        "year": row["year"],
        "art_version": row["art_version"],
        "suggestion_id": row["id"],
    }


async def _from_film(_: sqlite3.Connection, request: Request, option: OptionIn) -> dict:
    try:
        film = await films.resolve(
            emby_of(request),
            settings_of(request).data_dir,
            option.item_id,
            option.title,
            option.year,
        )
    except films.FilmProblem as error:
        raise HTTPException(422, str(error)) from error
    except EmbyUnavailable as error:
        raise HTTPException(502, "the emby server did not answer") from error
    return {
        "item_id": film["item_id"],
        "title": film["title"],
        "year": film["year"],
        "art_version": film["art_version"],
        "suggestion_id": None,
    }


async def _options(conn: sqlite3.Connection, request: Request, body: PollIn) -> list[dict]:
    options = [
        await (_from_film if option.suggestion_id is None else _from_suggestion)(
            conn, request, option
        )
        for option in body.options
    ]
    if len({polls.option_key(option) for option in options}) != len(options):
        raise HTTPException(422, "each film can only be an option once")
    return options


def _voter(request: Request, body: VoteIn) -> str:
    try:
        key = polls.voter_key(session_of(request), body.voter)
    except polls.VoterProblem as error:
        raise HTTPException(422, str(error)) from error
    return key


def _check_move(conn: sqlite3.Connection, poll: sqlite3.Row, target: str) -> None:
    if not polls.can_move(poll["status"], target):
        raise HTTPException(409, f"a {poll['status']} poll cannot move to {target}")
    other = poll_repo.open_poll(conn) if target == "open" else None
    if other is not None and other["id"] != poll["id"]:
        raise HTTPException(409, "another poll is already open")


@router.get("/club/poll")
async def current_poll(
    request: Request, voter: str | None = Query(default=None, max_length=64)
) -> dict:
    conn = conn_of(request)
    since = polls.results_since(datetime.now(UTC))
    poll = poll_repo.open_poll(conn) or poll_repo.recent_closed_poll(conn, since)
    return {"poll": _public(conn, poll, request, voter) if poll else None}


@router.post("/club/votes")
async def vote(request: Request, body: VoteIn) -> dict:
    require_same_site(request)
    conn = conn_of(request)
    poll = poll_repo.get_poll(conn, body.poll_id)
    if poll is None or poll["status"] != "open":
        raise HTTPException(404, "that poll is not open")
    if body.option_id not in {row["id"] for row in poll_repo.options_for(conn, body.poll_id)}:
        raise HTTPException(422, "that is not an option in this poll")
    key = _voter(request, body)
    limit_posts(request)
    session = session_of(request)
    poll_repo.cast_vote(
        conn,
        {
            "poll_id": body.poll_id,
            "option_id": body.option_id,
            "voter": key,
            "name": session.name if session else None,
        },
    )
    return {"my_vote": body.option_id}


@router.get("/club/settings")
async def club_settings(request: Request) -> dict:
    return {"board_schedule": repo.get_meta(conn_of(request), BOARD_SCHEDULE) != "off"}


@router.post("/club/admin/settings")
async def save_settings(request: Request, body: SettingsIn) -> dict:
    require_same_site(request)
    require_admin(request)
    repo.set_meta(conn_of(request), BOARD_SCHEDULE, "on" if body.board_schedule else "off")
    return {"board_schedule": body.board_schedule}


@router.get("/club/admin/polls")
async def list_polls(request: Request) -> dict:
    require_admin(request)
    conn = conn_of(request)
    return {"polls": [_admin(conn, poll) for poll in poll_repo.list_polls(conn)]}


@router.post("/club/admin/polls", status_code=201)
async def create_poll(request: Request, body: PollIn) -> dict:
    require_same_site(request)
    require_admin(request)
    conn = conn_of(request)
    poll_id = poll_repo.insert_poll(
        conn, body.question.strip(), await _options(conn, request, body)
    )
    return {"poll": _admin(conn, poll_repo.get_poll(conn, poll_id))}


@router.post("/club/admin/polls/{poll_id}")
async def update_poll(request: Request, poll_id: int, body: PollIn) -> dict:
    require_same_site(request)
    require_admin(request)
    conn = conn_of(request)
    if _existing(request, poll_id)["status"] != "draft":
        raise HTTPException(409, "only draft polls can be edited")
    poll_repo.replace_poll(
        conn, poll_id, body.question.strip(), await _options(conn, request, body)
    )
    return {"poll": _admin(conn, poll_repo.get_poll(conn, poll_id))}


@router.post("/club/admin/polls/{poll_id}/status")
async def move_poll(request: Request, poll_id: int, body: PollStatusIn) -> dict:
    require_same_site(request)
    require_admin(request)
    conn = conn_of(request)
    _check_move(conn, _existing(request, poll_id), body.status)
    poll_repo.set_status(conn, poll_id, body.status)
    return {"poll": _admin(conn, poll_repo.get_poll(conn, poll_id))}


@router.post("/club/admin/polls/{poll_id}/delete")
async def delete_poll(request: Request, poll_id: int) -> dict:
    require_same_site(request)
    require_admin(request)
    _existing(request, poll_id)
    poll_repo.delete_poll(conn_of(request), poll_id)
    return {"deleted": poll_id}
