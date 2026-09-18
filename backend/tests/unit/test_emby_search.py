import httpx
import pytest

from criterion.emby.auth import EmbyUnavailable
from criterion.emby.client import EmbyClient

USERS = [
    {"Id": "u-plain", "Policy": {"IsAdministrator": False}},
    {"Id": "u-admin", "Policy": {"IsAdministrator": True}},
]
FILM = {
    "Id": "m1",
    "Name": "There Will Be Blood",
    "ProductionYear": 2007,
    "Overview": "Oil.",
    "RunTimeTicks": 94800000000,
    "ImageTags": {"Primary": "tag-m1"},
}


class Emby:
    def __init__(self, items: list[dict] | None = None) -> None:
        self.items = [FILM] if items is None else items
        self.requests: list[httpx.Request] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        body = USERS if request.url.path == "/Users" else {"Items": self.items}
        return httpx.Response(200, json=body)

    def client(self) -> EmbyClient:
        return EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(self._handle))

    def paths(self) -> list[str]:
        return [request.url.path for request in self.requests]


async def test_searches_as_the_first_administrator():
    emby = Emby()
    await emby.client().search("blood")
    assert emby.paths() == ["/Users", "/Users/u-admin/Items"]


async def test_every_request_carries_the_token():
    emby = Emby()
    await emby.client().search("blood")
    assert all(r.headers["X-Emby-Token"] == "key" for r in emby.requests)


async def test_the_user_list_is_fetched_once():
    emby = Emby()
    client = emby.client()
    for term in ("blood", "clerks", "magnolia"):
        await client.search(term)
    assert emby.paths().count("/Users") == 1


async def test_search_asks_for_movies_by_name():
    emby = Emby()
    await emby.client().search("blood", limit=12)
    params = emby.requests[-1].url.params
    assert params["SearchTerm"] == "blood"
    assert params["IncludeItemTypes"] == "Movie"
    assert params["Recursive"] == "true"
    assert params["Limit"] == "12"


async def test_search_does_not_ask_for_media_sources():
    emby = Emby()
    await emby.client().search("blood")
    fields = emby.requests[-1].url.params["Fields"]
    assert "Overview" in fields and "RunTimeTicks" in fields
    assert "MediaSources" not in fields


async def test_lookup_filters_by_id():
    emby = Emby()
    film = await emby.client().lookup("m1")
    assert emby.requests[-1].url.params["Ids"] == "m1"
    assert (film.title, film.year, film.runtime_min) == ("There Will Be Blood", 2007, 158)
    assert film.image_tag == "tag-m1"


async def test_a_film_that_is_gone_reads_as_nothing():
    assert await Emby(items=[]).client().lookup("gone") is None


async def test_a_film_without_an_image_has_no_tag():
    bare = {"Id": "m3", "Name": "No Poster", "ProductionYear": 1999}
    film = await Emby(items=[bare]).client().lookup("m3")
    assert (film.image_tag, film.runtime_min, film.overview) == (None, None, None)


async def test_an_unreachable_server_is_reported():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    client = EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(handler))
    with pytest.raises(EmbyUnavailable):
        await client.search("blood")
