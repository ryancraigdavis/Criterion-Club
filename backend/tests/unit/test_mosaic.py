import asyncio

import pytest
from PIL import Image

from criterion.club import art, mosaic

NAME = "The Criterion Collection"


def _films(count: int, tag: str = "t") -> list[tuple[str, str]]:
    return [(f"m{i}", f"{tag}{i}") for i in range(count)]


@pytest.fixture
def criterion(fake_emby):
    fake_emby.collections[NAME] = _films(20)
    return fake_emby


def test_the_version_ignores_order_but_not_tags():
    films = _films(3)
    assert mosaic.version_of(films) == mosaic.version_of(list(reversed(films)))
    assert mosaic.version_of(films) != mosaic.version_of(_films(3, tag="new"))


@pytest.mark.parametrize(
    ("count", "rows"),
    [
        pytest.param(3, mosaic.COLUMNS, id="small-collection-fills-a-tall-tile"),
        pytest.param(227, 16, id="criterion-collection"),
        pytest.param(400, 25, id="large-collection"),
    ],
)
def test_the_sheet_is_a_full_grid(count, rows):
    images = [Image.new("RGB", (60, 90), (i % 255, 0, 0)) for i in range(count)]
    sheet = mosaic.compose(images)
    assert sheet.size == (mosaic.COLUMNS * mosaic.CELL[0], rows * mosaic.CELL[1])


def test_the_sheet_never_outgrows_webp():
    assert len(mosaic.capped(_films(5000))) * mosaic.CELL[1] / mosaic.COLUMNS <= mosaic.MAX_HEIGHT


def _step(image: Image.Image, upper: int, lower: int) -> int:
    above, below = image.getpixel((32, upper)), image.getpixel((32, lower))
    return max(abs(a - b) for a, b in zip(above, below, strict=True))


def test_the_blur_tiles_without_a_seam():
    sheet = Image.new("RGB", (64, 200), (200, 30, 30))
    sheet.paste((30, 30, 200), (0, 100, 64, 200))
    soft = mosaic.blurred(sheet, 4)
    seam, interior = _step(soft, 199, 0), _step(soft, 99, 100)
    assert abs(seam - interior) <= 2
    assert seam < 40


async def test_builds_a_mosaic_and_records_it(criterion, conn, data_dir):
    built = await mosaic.refresh(criterion, NAME, data_dir, conn)
    assert built["films"] == 20
    assert art.art_path(data_dir, mosaic.art_name(built["version"])).exists()
    assert mosaic.public(conn) == {
        "url": f"/api/club-art/mosaic-{built['version']}.webp",
        "width": built["width"],
        "height": built["height"],
    }


async def test_an_unchanged_collection_is_not_fetched_again(criterion, conn, data_dir):
    await mosaic.refresh(criterion, NAME, data_dir, conn)
    fetched = len(criterion.image_calls)
    await mosaic.refresh(criterion, NAME, data_dir, conn)
    assert len(criterion.image_calls) == fetched


async def test_a_changed_collection_replaces_the_old_mosaic(criterion, conn, data_dir):
    first = await mosaic.refresh(criterion, NAME, data_dir, conn)
    criterion.collections[NAME] = _films(21)
    second = await mosaic.refresh(criterion, NAME, data_dir, conn)
    assert second["version"] != first["version"]
    assert not art.art_path(data_dir, mosaic.art_name(first["version"])).exists()
    assert art.art_path(data_dir, mosaic.art_name(second["version"])).exists()


async def test_posters_that_fail_are_left_out(criterion, conn, data_dir):
    criterion.collections[NAME] = [*_films(4), ("missing", "tag")]
    built = await mosaic.refresh(criterion, NAME, data_dir, conn)
    assert built["films"] == 4


@pytest.mark.parametrize(
    "collections",
    [pytest.param({}, id="no-such-collection"), pytest.param({NAME: []}, id="empty-collection")],
)
async def test_nothing_is_built_without_films(fake_emby, conn, data_dir, collections):
    fake_emby.collections = collections
    assert await mosaic.refresh(fake_emby, NAME, data_dir, conn) is None
    assert mosaic.public(conn) is None


async def test_the_loop_survives_a_failure(mocker, conn, data_dir):
    calls = []

    async def flaky(*_):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("emby hiccup")

    mocker.patch("criterion.club.mosaic.refresh", flaky)
    task = asyncio.create_task(mosaic.keep_fresh(None, NAME, data_dir, conn, delay=0, every=0))
    while len(calls) < 3:
        await asyncio.sleep(0)
    task.cancel()
    assert len(calls) >= 3
