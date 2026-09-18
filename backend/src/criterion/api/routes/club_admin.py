import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import AwareDatetime, BaseModel, Field, HttpUrl

from criterion.api.deps import conn_of, emby_of, require_admin, require_same_site, settings_of
from criterion.club import art, events, films, rsvps
from criterion.db import club_repo
from criterion.emby.auth import EmbyUnavailable

router = APIRouter(tags=["club-admin"])


class ScreeningIn(BaseModel):
    item_id: str | None = Field(default=None, max_length=64)
    title: str = Field(default="", max_length=200)
    year: int | None = Field(default=None, ge=1880, le=2100)
    art_url: HttpUrl | None = None
    message: str = Field(default="", max_length=600)
    description: str = Field(default="", max_length=3000)
    starts_at: AwareDatetime
    location: str = Field(default="", max_length=200)
    status: Literal["draft", "published", "cancelled"] = "draft"


class StatusIn(BaseModel):
    status: Literal["new", "shortlisted", "scheduled", "declined"]


def _text(value: str) -> str | None:
    return value.strip() or None


def _url(value: HttpUrl | None) -> str | None:
    return str(value) if value else None


async def _resolve(request: Request, body: ScreeningIn) -> dict:
    try:
        film = await films.resolve(
            emby_of(request), settings_of(request).data_dir, body.item_id, body.title, body.year
        )
    except films.FilmProblem as error:
        raise HTTPException(422, str(error)) from error
    except EmbyUnavailable as error:
        raise HTTPException(502, "the emby server did not answer") from error
    return film


async def _typed_version(data_dir: Path, url: str | None, before: sqlite3.Row | None) -> str | None:
    same_link = url is not None and before is not None and before["art_url"] == url
    held = before["art_version"] if same_link else None
    return held or (await art.cache_url(url, data_dir) if url else None)


async def _fields(request: Request, body: ScreeningIn, before: sqlite3.Row | None = None) -> dict:
    film = await _resolve(request, body)
    typed_art = None if film["item_id"] else _url(body.art_url)
    data_dir = settings_of(request).data_dir
    return {
        "item_id": film["item_id"],
        "title": film["title"],
        "year": film["year"],
        "runtime_min": film["runtime_min"],
        "art_url": typed_art,
        "art_version": film["art_version"] or await _typed_version(data_dir, typed_art, before),
        "description": _text(body.description) or film["overview"],
        "message": _text(body.message),
        "starts_at": events.canonical(body.starts_at),
        "location": _text(body.location),
        "status": body.status,
    }


def _screening(request: Request, event_id: int) -> dict:
    return {"screening": events.admin(club_repo.get_event(conn_of(request), event_id))}


def _existing(request: Request, event_id: int) -> sqlite3.Row:
    row = club_repo.get_event(conn_of(request), event_id)
    if row is None:
        raise HTTPException(404, "no such screening")
    return row


@router.get("/club/admin/overview")
async def overview(request: Request) -> dict:
    session = require_admin(request)
    return {"name": session.name}


@router.get("/club/admin/events")
async def list_screenings(request: Request) -> dict:
    require_admin(request)
    conn = conn_of(request)
    counts = club_repo.rsvp_counts(conn)
    return {
        "screenings": [
            {**events.admin(row), "rsvps": rsvps.totals(counts.get(row["id"]))}
            for row in club_repo.list_events(conn)
        ]
    }


@router.post("/club/admin/events", status_code=201)
async def create_screening(request: Request, body: ScreeningIn) -> dict:
    require_same_site(request)
    require_admin(request)
    fields = await _fields(request, body)
    event_id = club_repo.insert_event(conn_of(request), fields)
    return _screening(request, event_id)


@router.post("/club/admin/events/{event_id}")
async def update_screening(request: Request, event_id: int, body: ScreeningIn) -> dict:
    require_same_site(request)
    require_admin(request)
    before = _existing(request, event_id)
    fields = await _fields(request, body, before)
    club_repo.update_event(conn_of(request), event_id, fields)
    return _screening(request, event_id)


@router.post("/club/admin/events/{event_id}/delete")
async def delete_screening(request: Request, event_id: int) -> dict:
    require_same_site(request)
    require_admin(request)
    _existing(request, event_id)
    club_repo.delete_event(conn_of(request), event_id)
    club_repo.delete_event_rsvps(conn_of(request), event_id)
    return {"deleted": event_id}


@router.get("/club/admin/events/{event_id}/rsvps")
async def screening_rsvps(request: Request, event_id: int) -> dict:
    require_admin(request)
    _existing(request, event_id)
    rows = club_repo.list_rsvps(conn_of(request), event_id)
    counts = club_repo.rsvp_counts(conn_of(request)).get(event_id)
    return {"rsvps": [rsvps.admin_rsvp(row) for row in rows], "totals": rsvps.totals(counts)}


@router.post("/club/admin/rsvps/{rsvp_id}/delete")
async def delete_rsvp(request: Request, rsvp_id: int) -> dict:
    require_same_site(request)
    require_admin(request)
    if not club_repo.delete_rsvp(conn_of(request), rsvp_id):
        raise HTTPException(404, "no such rsvp")
    return {"deleted": rsvp_id}


@router.get("/club/admin/suggestions")
async def list_suggestions(request: Request) -> dict:
    require_admin(request)
    rows = club_repo.list_suggestions(conn_of(request))
    return {"suggestions": [rsvps.admin_suggestion(row) for row in rows]}


@router.post("/club/admin/suggestions/{suggestion_id}")
async def set_suggestion_status(request: Request, suggestion_id: int, body: StatusIn) -> dict:
    require_same_site(request)
    require_admin(request)
    if not club_repo.set_suggestion_status(conn_of(request), suggestion_id, body.status):
        raise HTTPException(404, "no such suggestion")
    return {"id": suggestion_id, "status": body.status}


@router.post("/club/admin/suggestions/{suggestion_id}/delete")
async def delete_suggestion(request: Request, suggestion_id: int) -> dict:
    require_same_site(request)
    require_admin(request)
    if not club_repo.delete_suggestion(conn_of(request), suggestion_id):
        raise HTTPException(404, "no such suggestion")
    return {"deleted": suggestion_id}
