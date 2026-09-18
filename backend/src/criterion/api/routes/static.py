from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

IMMUTABLE = "public, max-age=31536000, immutable"


class CacheHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        immutable = request.url.path.startswith("/api/club-art/")
        response.headers.update({"Cache-Control": IMMUTABLE} if immutable else {})
        return response


def mount_static(app: FastAPI, data_dir: Path) -> None:
    art = data_dir / "club-art"
    art.mkdir(parents=True, exist_ok=True)
    app.mount("/api/club-art", StaticFiles(directory=art), name="club-art")
    app.add_middleware(CacheHeaderMiddleware)
