import time
from itertools import chain

import httpx
import structlog

from criterion.emby import auth
from criterion.emby.auth import EmbyUnavailable
from criterion.emby.models import EmbyUser, Film

FIELDS = "Overview,ProductionYear,RunTimeTicks,ImageTags"
TICKS_PER_MINUTE = 600_000_000
SEARCH_LIMIT = 20
TIMEOUT = 8.0
FAILURE_MEMORY = 60.0

log = structlog.get_logger()


def _is_admin(user: dict) -> bool:
    return bool((user.get("Policy") or {}).get("IsAdministrator"))


def _runtime_minutes(ticks: int | None) -> int | None:
    return None if ticks is None else round(ticks / TICKS_PER_MINUTE)


def film_of(raw: dict) -> Film:
    return Film(
        item_id=str(raw.get("Id") or ""),
        title=str(raw.get("Name") or "").strip(),
        year=raw.get("ProductionYear"),
        overview=raw.get("Overview"),
        runtime_min=_runtime_minutes(raw.get("RunTimeTicks")),
        image_tag=(raw.get("ImageTags") or {}).get("Primary"),
    )


class EmbyClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = TIMEOUT,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"X-Emby-Token": api_key},
            timeout=timeout,
            transport=transport,
        )
        self._base_url = base_url
        self._transport = transport
        self._user_id: str | None = None
        self._server_id: str | None = None
        self._retry_at = 0.0

    async def close(self) -> None:
        await self._http.aclose()

    async def authenticate(self, username: str, password: str) -> EmbyUser:
        return await auth.authenticate(self._base_url, username, password, self._transport)

    async def _get_json(self, path: str, params: dict | None = None) -> dict:
        try:
            response = await self._http.get(path, params=params)
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as error:
            log.warning("emby_unavailable", path=path, error=str(error))
            raise EmbyUnavailable(str(error)) from error
        return body

    async def _pick_user(self) -> str:
        users = await self._get_json("/Users")
        chosen = next(chain(filter(_is_admin, users), users), None)
        if chosen is None:
            raise EmbyUnavailable("emby has no users")
        return str(chosen["Id"])

    async def user_id(self) -> str:
        self._user_id = self._user_id or await self._pick_user()
        return self._user_id

    async def _public_server_id(self) -> str | None:
        try:
            info = await self._get_json("/System/Info/Public")
        except EmbyUnavailable:
            info = {}
        return info.get("Id")

    async def ping(self) -> bool:
        return await self._public_server_id() is not None

    async def _server_id_now(self) -> str | None:
        found = await self._public_server_id() if time.monotonic() >= self._retry_at else None
        self._retry_at = self._retry_at if found else time.monotonic() + FAILURE_MEMORY
        return found

    async def server_id(self) -> str | None:
        self._server_id = self._server_id or await self._server_id_now()
        return self._server_id

    async def _items(self, params: dict) -> list[dict]:
        uid = await self.user_id()
        page = await self._get_json(
            f"/Users/{uid}/Items",
            {"IncludeItemTypes": "Movie", "Recursive": "true", "Fields": FIELDS, **params},
        )
        return list(page.get("Items", []))

    async def search(self, term: str, limit: int = SEARCH_LIMIT) -> list[Film]:
        items = await self._items(
            {"SearchTerm": term, "SortBy": "SortName", "SortOrder": "Ascending", "Limit": limit}
        )
        return [film_of(raw) for raw in items]

    async def lookup(self, item_id: str) -> Film | None:
        items = await self._items({"Ids": item_id, "Limit": 1})
        return next((film_of(raw) for raw in items), None)

    async def image_bytes(self, item_id: str, tag: str, max_width: int) -> bytes | None:
        try:
            response = await self._http.get(
                f"/Items/{item_id}/Images/Primary",
                params={"tag": tag, "maxWidth": max_width, "quality": 85},
            )
        except httpx.HTTPError as error:
            raise EmbyUnavailable(str(error)) from error
        return response.content if response.status_code == 200 else None
