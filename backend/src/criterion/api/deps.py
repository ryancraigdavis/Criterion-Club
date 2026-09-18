import time
from urllib.parse import urlsplit

import structlog
from fastapi import HTTPException, Request

from criterion.club import sessions
from criterion.club.sessions import Session
from criterion.club.throttle import Throttle, TooManyAttempts
from criterion.config import Settings
from criterion.emby.client import EmbyClient

log = structlog.get_logger()


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def emby_of(request: Request) -> EmbyClient:
    return request.app.state.emby


def conn_of(request: Request):
    return request.app.state.conn


def throttle_of(request: Request) -> Throttle:
    return request.app.state.login_throttle


def _limit(request: Request, throttle: Throttle, detail: str) -> None:
    keys, now = [f"ip:{client_address(request)}"], time.time()
    try:
        throttle.check(keys, now)
    except TooManyAttempts as error:
        log.warning("throttled", keys=keys, path=request.url.path)
        raise HTTPException(429, detail) from error
    throttle.record(keys, now)


def limit_posts(request: Request) -> None:
    _limit(
        request, request.app.state.post_throttle, "too many submissions, try again in a few minutes"
    )


def limit_searches(request: Request) -> None:
    _limit(request, request.app.state.search_throttle, "too many searches, slow down a moment")


def session_of(request: Request) -> Session | None:
    token = request.cookies.get(sessions.COOKIE, "")
    try:
        session = sessions.read(token, settings_of(request).session_secret, time.time())
    except ValueError:
        session = None
    return session


def require_admin(request: Request) -> Session:
    session = session_of(request)
    if not sessions.is_admin(session, settings_of(request).club_admin_names):
        raise HTTPException(status_code=403 if session else 401, detail="club admins only")
    return session


def _hostname(value: str) -> str:
    return (urlsplit(value if "//" in value else f"//{value}").hostname or "").casefold()


def require_same_site(request: Request) -> None:
    origin = request.headers.get("origin")
    trusted = {
        _hostname(request.headers.get("host", "")),
        _hostname(request.headers.get("x-forwarded-host", "")),
        _hostname(settings_of(request).frontend_origin),
    }
    if origin is not None and _hostname(origin) not in trusted:
        raise HTTPException(status_code=403, detail="cross-site request refused")


def client_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")
