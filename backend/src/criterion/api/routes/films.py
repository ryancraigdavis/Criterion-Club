from fastapi import APIRouter, HTTPException, Query, Request
from fastapi import Path as PathParam
from fastapi.responses import FileResponse

from criterion.api.deps import emby_of, limit_searches, require_same_site, settings_of
from criterion.api.routes.static import IMMUTABLE
from criterion.club import art, search, thumbs
from criterion.emby.auth import EmbyUnavailable
from criterion.emby.models import Film

router = APIRouter(tags=["club"])


def _shown(film: Film, secret: str) -> dict:
    return {
        **film.model_dump(exclude={"image_tag", "trailer_url"}),
        "thumb_url": thumbs.thumb_url(secret, film.item_id, film.image_tag),
    }


async def _hits(request: Request, query: search.Query) -> list[dict]:
    limit_searches(request)
    emby = emby_of(request)
    try:
        found = await (emby.exact(query.term) if query.exact else emby.search(query.term))
    except EmbyUnavailable as error:
        raise HTTPException(502, "the emby server did not answer") from error
    secret = settings_of(request).emby_server_api
    return [_shown(film, secret) for film in found]


@router.get("/club/films")
async def search_films(request: Request, q: str = Query(default="", max_length=120)) -> dict:
    require_same_site(request)
    query = search.parse(q)
    return {"films": await _hits(request, query) if search.searchable(query) else []}


@router.get("/club/films/{item_id}/thumb")
async def film_thumb(
    request: Request,
    item_id: str = PathParam(max_length=64),
    tag: str = Query(max_length=64),
    sig: str = Query(max_length=64),
) -> FileResponse:
    settings = settings_of(request)
    # Only thumbnails this server handed out in a search result are served: the URL is signed.
    if not thumbs.valid(settings.emby_server_api, item_id, tag, sig):
        raise HTTPException(404, "no such thumbnail")
    try:
        path = await thumbs.ensure(emby_of(request), settings.data_dir, item_id, tag)
    except art.FAILURES as error:
        raise HTTPException(502, "the poster could not be fetched") from error
    if path is None:
        raise HTTPException(404, "no such thumbnail")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": IMMUTABLE})
