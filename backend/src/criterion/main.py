from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from criterion.api.errors import register_exception_handlers
from criterion.api.routes import (
    club,
    club_admin,
    club_members,
    club_polls,
    club_settings,
    films,
    site,
)
from criterion.api.routes.static import mount_static
from criterion.club.throttle import Throttle
from criterion.config import Settings, get_settings
from criterion.db.connection import connect
from criterion.emby.client import EmbyClient
from criterion.logging import configure_logging

log = structlog.get_logger()


def _lifespan(settings: Settings, client: EmbyClient | None):
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(settings.data_dir)
        emby = client or EmbyClient(settings.emby_base, settings.emby_server_api)
        app.state.settings, app.state.conn, app.state.emby = settings, conn, emby
        app.state.login_throttle = Throttle()
        app.state.post_throttle = Throttle(limit=30, window=600.0)
        app.state.search_throttle = Throttle(limit=60, window=60.0)
        log.info(
            "started",
            emby=settings.emby_base,
            data_dir=str(settings.data_dir),
            sign_in=bool(settings.session_secret),
            admins=len(settings.club_admin_names),
            secure_cookies=settings.secure_cookies,
        )
        yield
        await emby.close()
        conn.close()

    return lifespan


def create_app(settings: Settings | None = None, client: EmbyClient | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)
    app = FastAPI(
        title="Criterion Club API",
        version="0.1.0",
        lifespan=_lifespan(settings, client),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    mount_static(app, settings.data_dir)
    app.include_router(site.router, prefix="/api")
    app.include_router(films.router, prefix="/api")
    app.include_router(club.router, prefix="/api")
    app.include_router(club_admin.router, prefix="/api")
    app.include_router(club_members.router, prefix="/api")
    app.include_router(club_polls.router, prefix="/api")
    app.include_router(club_settings.router, prefix="/api")
    return app
