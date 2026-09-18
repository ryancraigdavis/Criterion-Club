import time
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from criterion.api.deps import (
    client_address,
    conn_of,
    require_same_site,
    session_of,
    settings_of,
    throttle_of,
)
from criterion.club import events, sessions
from criterion.club.throttle import TooManyAttempts
from criterion.db import club_repo
from criterion.emby.auth import EmbyUnavailable, InvalidLogin
from criterion.emby.models import EmbyUser

router = APIRouter(tags=["club"])
log = structlog.get_logger()


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(default="", max_length=512)


def _describe(request: Request, session: sessions.Session | None) -> dict:
    admins = settings_of(request).club_admin_names
    return {
        "name": session.name if session else None,
        "admin": sessions.is_admin(session, admins),
    }


def _throttle_keys(request: Request, username: str) -> list[str]:
    return [f"ip:{client_address(request)}", f"user:{username.strip().casefold()}"]


async def _verify(request: Request, credentials: Credentials) -> EmbyUser:
    throttle = throttle_of(request)
    keys = _throttle_keys(request, credentials.username)
    now = time.time()
    try:
        throttle.check(keys, now)
        user = await request.app.state.emby.authenticate(
            credentials.username.strip(), credentials.password
        )
    except TooManyAttempts as error:
        log.warning("throttled", keys=keys, path=request.url.path)
        raise HTTPException(429, "too many sign-in attempts, try again in a few minutes") from error
    except InvalidLogin as error:
        log.info("sign_in_refused", username=credentials.username.strip())
        throttle.record(keys, now)
        raise HTTPException(401, "invalid username or password") from error
    except EmbyUnavailable as error:
        log.warning("sign_in_emby_unavailable", error=str(error))
        raise HTTPException(502, "the emby server did not answer") from error
    throttle.clear(keys)
    log.info("signed_in", name=user.name)
    return user


@router.post("/club/login")
async def login(request: Request, response: Response, credentials: Credentials) -> dict:
    require_same_site(request)
    settings = settings_of(request)
    if not settings.session_secret:
        raise HTTPException(503, "sign-in is not configured")
    user = await _verify(request, credentials)
    token = sessions.issue(user.id, user.name, settings.session_secret, time.time())
    response.set_cookie(
        sessions.COOKIE,
        token,
        max_age=sessions.TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
        path="/",
    )
    return _describe(request, sessions.read(token, settings.session_secret, time.time()))


@router.post("/club/logout")
async def logout(request: Request, response: Response) -> dict:
    require_same_site(request)
    response.delete_cookie(sessions.COOKIE, path="/")
    return {"name": None, "admin": False}


@router.get("/club/me")
async def me(request: Request) -> dict:
    return _describe(request, session_of(request))


@router.get("/club/next")
async def next_screening(request: Request) -> dict:
    rows = club_repo.upcoming_events(conn_of(request), events.cutoff(datetime.now(UTC)), 1)
    return {"screening": next((events.public(row) for row in rows), None)}


@router.get("/club/schedule")
async def schedule(request: Request, limit: int = Query(default=4, ge=1, le=12)) -> dict:
    rows = club_repo.upcoming_events(conn_of(request), events.cutoff(datetime.now(UTC)), limit)
    return {"screenings": [events.public(row) for row in rows]}


@router.get("/club/past")
async def past(request: Request, limit: int = Query(default=24, ge=1, le=60)) -> dict:
    rows = club_repo.past_events(conn_of(request), events.cutoff(datetime.now(UTC)), limit)
    return {"screenings": [events.past(row) for row in rows]}
