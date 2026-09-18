from io import BytesIO

import httpx
import pytest
from PIL import Image

from criterion.club import art


def _png(size=(900, 1350)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (120, 40, 20)).save(buffer, "PNG")
    return buffer.getvalue()


def _serving(response: httpx.Response) -> httpx.MockTransport:
    return httpx.MockTransport(lambda request: response)


class _Emby:
    def __init__(self, raw: bytes | None) -> None:
        self.raw = raw
        self.calls: list[tuple[str, str]] = []

    async def image_bytes(self, item_id: str, tag: str, max_width: int) -> bytes | None:
        self.calls.append((item_id, tag))
        return self.raw


async def test_caches_a_resized_webp(tmp_path):
    raw = _png()
    version = await art.cache_url(
        "https://img.example/poster.png", tmp_path, _serving(httpx.Response(200, content=raw))
    )
    assert version and len(version) == 12
    with Image.open(art.art_path(tmp_path, version)) as stored:
        assert stored.format == "WEBP"
        assert stored.width == art.ART_WIDTH


async def test_writes_a_thumb_beside_the_poster(tmp_path):
    version = await art.cache_url(
        "https://img.example/p", tmp_path, _serving(httpx.Response(200, content=_png()))
    )
    with Image.open(art.art_path(tmp_path, version, art.THUMB)) as thumb:
        assert (thumb.width, thumb.height) == art.THUMB_SIZE


@pytest.mark.parametrize(
    "response",
    [
        pytest.param(httpx.Response(404), id="missing"),
        pytest.param(httpx.Response(200, content=b"<html>nope</html>"), id="not-an-image"),
        pytest.param(httpx.Response(200, content=b"x" * (art.MAX_BYTES + 1)), id="too-large"),
    ],
)
async def test_failures_store_nothing(tmp_path, response):
    assert await art.cache_url("https://img.example/p", tmp_path, _serving(response)) is None
    assert not art.art_dir(tmp_path).exists() or not list(art.art_dir(tmp_path).iterdir())


async def test_unreachable_host(tmp_path):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    transport = httpx.MockTransport(handler)
    assert await art.cache_url("https://img.example/p", tmp_path, transport) is None


def test_emby_version_is_stable_per_tag():
    assert art.emby_version("m1", "tag") == art.emby_version("m1", "tag")
    assert art.emby_version("m1", "tag") != art.emby_version("m1", "other")


async def test_caches_an_emby_poster(tmp_path):
    emby = _Emby(_png())
    version = await art.cache_emby(emby, "m1", "tag-m1", tmp_path)
    assert version == art.emby_version("m1", "tag-m1")
    assert art.art_path(tmp_path, version).exists()
    assert art.art_path(tmp_path, version, art.THUMB).exists()


async def test_a_held_poster_is_not_fetched_again(tmp_path):
    emby = _Emby(_png())
    await art.cache_emby(emby, "m1", "tag-m1", tmp_path)
    again = await art.cache_emby(emby, "m1", "tag-m1", tmp_path)
    assert again == art.emby_version("m1", "tag-m1")
    assert len(emby.calls) == 1


async def test_a_film_without_an_image_has_no_version(tmp_path):
    assert await art.cache_emby(_Emby(None), "m3", "tag-m3", tmp_path) is None


async def test_a_poster_missing_its_thumb_is_fetched_again(tmp_path):
    emby = _Emby(_png())
    version = await art.cache_emby(emby, "m1", "tag-m1", tmp_path)
    art.art_path(tmp_path, version, art.THUMB).unlink()
    await art.cache_emby(emby, "m1", "tag-m1", tmp_path)
    assert len(emby.calls) == 2
    assert art.is_held(tmp_path, version)


async def test_writes_leave_no_partial_files(tmp_path):
    await art.cache_emby(_Emby(_png()), "m1", "tag-m1", tmp_path)
    assert sorted(path.suffix for path in art.art_dir(tmp_path).iterdir()) == [".webp", ".webp"]
