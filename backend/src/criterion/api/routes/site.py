from fastapi import APIRouter, Request

from criterion.api.deps import emby_of, settings_of

router = APIRouter(tags=["site"])


@router.get("/health")
async def health(request: Request) -> dict:
    return {"status": "ok", "emby_ok": await emby_of(request).ping()}


@router.get("/site")
async def site(request: Request) -> dict:
    return {
        "emby_url": settings_of(request).emby_public,
        "emby_server_id": await emby_of(request).server_id(),
    }
