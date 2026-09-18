from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from criterion.api.deps import (
    conn_of,
    emby_of,
    limit_posts,
    require_same_site,
    session_of,
    settings_of,
)
from criterion.club import events, films, rsvps
from criterion.club.sessions import Session
from criterion.db import club_repo
from criterion.emby.auth import EmbyUnavailable

router = APIRouter(tags=["club"])


class RsvpIn(BaseModel):
    event_id: int
    name: str = Field(default="", max_length=80)
    answer: Literal["yes", "maybe", "no"]
    guests: int = Field(default=0, ge=0, le=10)
    note: str = Field(default="", max_length=500)


class SuggestionIn(BaseModel):
    item_id: str | None = Field(default=None, max_length=64)
    title: str = Field(default="", max_length=200)
    year: int | None = Field(default=None, ge=1880, le=2100)
    name: str = Field(default="", max_length=80)
    note: str = Field(default="", max_length=500)


def _taking_rsvps(request: Request, event_id: int) -> None:
    row = club_repo.get_event(conn_of(request), event_id)
    cutoff = events.cutoff(datetime.now(UTC))
    open_for_rsvps = row is not None and row["status"] == "published" and row["starts_at"] >= cutoff
    if not open_for_rsvps:
        raise HTTPException(404, "that screening is not taking rsvps")


def _member_name(session: Session | None, typed: str) -> str:
    name = session.name if session else rsvps.tidy_name(typed)
    if not name:
        raise HTTPException(422, "tell us your name")
    return name


async def _film(request: Request, body: SuggestionIn) -> dict:
    try:
        film = await films.resolve(
            emby_of(request), settings_of(request).data_dir, body.item_id, body.title, body.year
        )
    except films.FilmProblem as error:
        raise HTTPException(422, str(error)) from error
    except EmbyUnavailable as error:
        raise HTTPException(502, "the emby server did not answer") from error
    return film


@router.post("/club/rsvp")
async def rsvp(request: Request, body: RsvpIn) -> dict:
    require_same_site(request)
    _taking_rsvps(request, body.event_id)
    session = session_of(request)
    name = _member_name(session, body.name)
    limit_posts(request)
    person = rsvps.person_key(session, name)
    club_repo.upsert_rsvp(
        conn_of(request),
        {
            "event_id": body.event_id,
            "person": person,
            "name": name,
            "emby_user_id": session.uid if session else None,
            "answer": body.answer,
            "guests": 0 if body.answer == "no" else body.guests,
            "note": body.note.strip() or None,
        },
    )
    return {"rsvp": rsvps.echo(club_repo.rsvp_for(conn_of(request), body.event_id, person))}


@router.get("/club/rsvp")
async def my_rsvp(request: Request, event_id: int) -> dict:
    session = session_of(request)
    row = (
        club_repo.rsvp_for(conn_of(request), event_id, rsvps.person_key(session, ""))
        if session
        else None
    )
    return {"rsvp": rsvps.echo(row) if row else None}


@router.post("/club/suggestions", status_code=201)
async def suggest(request: Request, body: SuggestionIn) -> dict:
    require_same_site(request)
    session = session_of(request)
    name = _member_name(session, body.name)
    limit_posts(request)
    film = await _film(request, body)
    club_repo.insert_suggestion(
        conn_of(request),
        {
            "item_id": film["item_id"],
            "title": film["title"],
            "year": film["year"],
            "art_version": film["art_version"],
            "name": name,
            "emby_user_id": session.uid if session else None,
            "note": body.note.strip() or None,
        },
    )
    return {"suggestion": {"title": film["title"], "year": film["year"]}}
