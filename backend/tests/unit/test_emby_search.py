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


class Counting:
    def __init__(self, status: int = 200) -> None:
        self.status = status
        self.paths: list[str] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.paths.append(request.url.path)
        return httpx.Response(self.status, json={"Id": "server-1"})

    def client(self) -> EmbyClient:
        return EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(self._handle))


async def test_the_server_id_is_fetched_once():
    emby = Counting()
    client = emby.client()
    assert [await client.server_id() for _ in range(3)] == ["server-1"] * 3
    assert len(emby.paths) == 1


async def test_an_unreachable_server_id_is_not_retried_at_once():
    emby = Counting(status=503)
    client = emby.client()
    assert [await client.server_id() for _ in range(3)] == [None] * 3
    assert len(emby.paths) == 1


@pytest.mark.parametrize(
    ("status", "expected"),
    [pytest.param(200, True, id="answering"), pytest.param(503, False, id="down")],
)
async def test_ping_asks_every_time(status, expected):
    emby = Counting(status=status)
    client = emby.client()
    assert [await client.ping() for _ in range(2)] == [expected, expected]
    assert len(emby.paths) == 2


async def test_a_server_without_users_is_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[] if request.url.path == "/Users" else {"Items": []})

    client = EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(handler))
    with pytest.raises(EmbyUnavailable):
        await client.search("blood")


async def test_falls_back_to_the_first_user_without_an_administrator():
    users = [{"Id": "u-one", "Policy": {}}, {"Id": "u-two"}]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=users if request.url.path == "/Users" else {"Items": []})

    client = EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(handler))
    assert await client.user_id() == "u-one"


class Collections:
    def __init__(self, boxsets: list[dict], members: list[dict]) -> None:
        self.boxsets, self.members = boxsets, members
        self.requests: list[httpx.Request] = []

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        params = request.url.params
        body = (
            USERS
            if request.url.path == "/Users"
            else {
                "Items": self.boxsets
                if params.get("IncludeItemTypes") == "BoxSet"
                else self.members
            }
        )
        return httpx.Response(200, json=body)

    def client(self) -> EmbyClient:
        return EmbyClient("http://emby.test", "key", transport=httpx.MockTransport(self._handle))


BOXSETS = [
    {"Id": "b-other", "Name": "Criterion Collection Extras"},
    {"Id": "b-crit", "Name": "The Criterion Collection"},
]
MEMBERS = [
    {"Id": "m1", "ImageTags": {"Primary": "p1"}},
    {"Id": "m2", "ImageTags": {}},
    {"Id": "m3", "ImageTags": {"Primary": "p3"}},
]


async def test_collection_posters_use_the_exactly_named_boxset():
    emby = Collections(BOXSETS, MEMBERS)
    posters = await emby.client().collection_posters("the criterion collection")
    assert posters == [("m1", "p1"), ("m3", "p3")]
    assert emby.requests[-1].url.params["ParentId"] == "b-crit"


async def test_a_missing_collection_has_no_posters():
    emby = Collections([{"Id": "b-other", "Name": "Something Else"}], MEMBERS)
    assert await emby.client().collection_posters("The Criterion Collection") == []
    assert all("ParentId" not in request.url.params for request in emby.requests)
