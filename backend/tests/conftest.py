import json
import sqlite3
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from criterion.config import Settings
from criterion.db.connection import connect
from criterion.emby.auth import EmbyUnavailable, InvalidLogin
from criterion.emby.client import film_of
from criterion.emby.models import EmbyUser, Film
from criterion.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"
EMBY_ACCOUNTS = {
    "ryan": ("projector", EmbyUser(id="u-ryan", name="Ryan")),
    "guest": ("", EmbyUser(id="u-guest", name="Guest")),
}


def _png(color: tuple[int, int, int]) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (200, 300), color).save(buf, "PNG")
    return buf.getvalue()


class FakeEmby:
    def __init__(self, films: list[dict]) -> None:
        self.films = films
        self.down = False
        self.search_calls: list[str] = []
        self.image_calls: list[tuple[str, str]] = []
        self.collections: dict[str, list[tuple[str, str]]] = {}

    def _answer(self) -> None:
        if self.down:
            raise EmbyUnavailable("emby is not answering")

    async def close(self) -> None:
        return None

    async def server_id(self) -> str | None:
        return None if self.down else "server-1"

    async def ping(self) -> bool:
        return not self.down

    async def authenticate(self, username: str, password: str) -> EmbyUser:
        self._answer()
        expected, user = EMBY_ACCOUNTS.get(username.casefold(), (None, None))
        if user is None or password != expected:
            raise InvalidLogin(username)
        return user

    async def search(self, term: str, limit: int = 20) -> list[Film]:
        self._answer()
        self.search_calls.append(term)
        hits = [raw for raw in self.films if term.casefold() in str(raw["Name"]).casefold()]
        return [film_of(raw) for raw in hits[:limit]]

    async def lookup(self, item_id: str) -> Film | None:
        self._answer()
        return next((film_of(raw) for raw in self.films if raw["Id"] == item_id), None)

    async def collection_posters(self, name: str) -> list[tuple[str, str]]:
        self._answer()
        return list(self.collections.get(name, []))

    async def image_bytes(self, item_id: str, tag: str, max_width: int) -> bytes | None:
        self._answer()
        self.image_calls.append((item_id, tag))
        return None if item_id == "missing" else _png((120, 40, 20))


@pytest.fixture
def films() -> list[dict]:
    return json.loads((FIXTURES / "club_films.json").read_text())


@pytest.fixture
def fake_emby(films: list[dict]) -> FakeEmby:
    return FakeEmby(films)


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    return tmp_path / "data"


@pytest.fixture
def conn(data_dir: Path) -> sqlite3.Connection:
    connection = connect(data_dir)
    yield connection
    connection.close()


@pytest.fixture
def settings(data_dir: Path) -> Settings:
    return Settings(
        emby_server_url="http://emby.test",
        emby_server_api="key",
        data_dir=data_dir,
        session_secret="test-session-secret",
        club_admins="Ryan",
        mosaic_collection="",
    )


@pytest.fixture
def api(settings: Settings, fake_emby: FakeEmby) -> TestClient:
    with TestClient(create_app(settings, fake_emby)) as client:
        yield client
