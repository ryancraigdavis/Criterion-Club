from fastapi import APIRouter, HTTPException, Query, Request

from criterion.api.deps import emby_of, limit_searches, require_same_site
from criterion.emby.auth import EmbyUnavailable

router = APIRouter(tags=["club"])

MIN_QUERY = 2


async def _hits(request: Request, term: str) -> list[dict]:
    limit_searches(request)
    try:
        found = await emby_of(request).search(term)
    except EmbyUnavailable as error:
        raise HTTPException(502, "the emby server did not answer") from error
    return [film.model_dump(exclude={"image_tag"}) for film in found]


@router.get("/club/films")
async def search_films(request: Request, q: str = Query(default="", max_length=120)) -> dict:
    require_same_site(request)
    term = q.strip()
    return {"films": await _hits(request, term) if len(term) >= MIN_QUERY else []}
