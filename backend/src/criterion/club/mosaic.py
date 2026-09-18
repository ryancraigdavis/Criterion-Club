import asyncio
import hashlib
import json
import random
import sqlite3
from io import BytesIO
from math import ceil
from pathlib import Path

import structlog
from PIL import Image, ImageFilter, ImageOps

from criterion.club import art
from criterion.db import repo
from criterion.emby.auth import EmbyUnavailable

log = structlog.get_logger()

META_KEY = "club_mosaic"
COLUMNS = 16
CELL = (80, 120)
FETCH_WIDTH = 120
BLUR = 2.5
QUALITY = 70
CONCURRENCY = 4
MAX_HEIGHT = 16_000
START_DELAY = 30.0
EVERY = 24 * 3600.0
FAILURES = (EmbyUnavailable, OSError, ValueError, Image.DecompressionBombError)

Pairs = list[tuple[str, str]]


def version_of(pairs: Pairs) -> str:
    joined = "\n".join(sorted(f"{item_id}:{tag}" for item_id, tag in pairs))
    return hashlib.sha1(joined.encode()).hexdigest()[:12]


def art_name(version: str) -> str:
    return f"mosaic-{version}"


def capped(pairs: Pairs) -> Pairs:
    return pairs[: COLUMNS * (MAX_HEIGHT // CELL[1])]


def shuffled(pairs: Pairs, version: str) -> Pairs:
    order = sorted(pairs)
    random.Random(version).shuffle(order)
    return order


def rows_for(count: int) -> int:
    return max(ceil(count / COLUMNS), COLUMNS)


def compose(images: list[Image.Image]) -> Image.Image:
    rows = rows_for(len(images))
    sheet = Image.new("RGB", (COLUMNS * CELL[0], rows * CELL[1]))
    for index in range(COLUMNS * rows):
        tile = ImageOps.fit(images[index % len(images)], CELL, Image.Resampling.LANCZOS)
        sheet.paste(tile, ((index % COLUMNS) * CELL[0], (index // COLUMNS) * CELL[1]))
    return sheet


def blurred(sheet: Image.Image, radius: float) -> Image.Image:
    # Wrap the bottom above the top (and the top below) before blurring, so the result tiles.
    pad = int(radius * 4) + 1
    width, height = sheet.size
    tall = Image.new("RGB", (width, height + 2 * pad))
    tall.paste(sheet.crop((0, height - pad, width, height)), (0, 0))
    tall.paste(sheet, (0, pad))
    tall.paste(sheet.crop((0, 0, width, pad)), (0, pad + height))
    return tall.filter(ImageFilter.GaussianBlur(radius)).crop((0, pad, width, pad + height))


def current(conn: sqlite3.Connection) -> dict | None:
    raw = repo.get_meta(conn, META_KEY)
    return json.loads(raw) if raw else None


def public(conn: sqlite3.Connection) -> dict | None:
    held = current(conn)
    return (
        {
            "url": art.art_url(art_name(held["version"])),
            "width": held["width"],
            "height": held["height"],
        }
        if held
        else None
    )


def _is_current(held: dict | None, version: str, data_dir: Path) -> bool:
    same = held is not None and held["version"] == version
    return same and art.art_path(data_dir, art_name(version)).exists()


async def _poster(client, gate: asyncio.Semaphore, item_id: str, tag: str) -> Image.Image | None:
    async with gate:
        try:
            raw = await client.image_bytes(item_id, tag, FETCH_WIDTH)
            image = Image.open(BytesIO(raw)).convert("RGB") if raw else None
        except FAILURES as error:
            log.info("mosaic_poster_skipped", item_id=item_id, error=str(error))
            image = None
    return image


async def _posters(client, pairs: Pairs) -> list[Image.Image]:
    gate = asyncio.Semaphore(CONCURRENCY)
    found = await asyncio.gather(*(_poster(client, gate, item, tag) for item, tag in pairs))
    return [image for image in found if image is not None]


def _render(images: list[Image.Image], data_dir: Path, version: str) -> dict:
    sheet = blurred(compose(images), BLUR)
    art.art_dir(data_dir).mkdir(parents=True, exist_ok=True)
    art.save_atomically(sheet, art.art_path(data_dir, art_name(version)), quality=QUALITY)
    return {"version": version, "width": sheet.width, "height": sheet.height, "films": len(images)}


def _record(conn: sqlite3.Connection, data_dir: Path, held: dict | None, built: dict) -> None:
    repo.set_meta(conn, META_KEY, json.dumps(built))
    # The one exception to "art is never deleted": nothing but the club page uses a mosaic.
    replaced = held["version"] if held and held["version"] != built["version"] else None
    art.art_path(data_dir, art_name(replaced)).unlink(missing_ok=True) if replaced else None


async def _rebuild(
    client, pairs: Pairs, version: str, data_dir: Path, conn: sqlite3.Connection
) -> dict | None:
    held = current(conn)
    images = await _posters(client, shuffled(pairs, version))
    built = await asyncio.to_thread(_render, images, data_dir, version) if images else held
    _record(conn, data_dir, held, built) if images else None
    return built


async def refresh(client, name: str, data_dir: Path, conn: sqlite3.Connection) -> dict | None:
    pairs = capped(await client.collection_posters(name))
    version = version_of(pairs)
    stale = bool(pairs) and not _is_current(current(conn), version, data_dir)
    result = await _rebuild(client, pairs, version, data_dir, conn) if stale else current(conn)
    log.info("mosaic_checked", collection=name, films=len(pairs), rebuilt=stale)
    return result


async def keep_fresh(
    client,
    name: str,
    data_dir: Path,
    conn: sqlite3.Connection,
    *,
    delay: float = START_DELAY,
    every: float = EVERY,
) -> None:
    await asyncio.sleep(delay)
    while True:
        try:
            await refresh(client, name, data_dir, conn)
        except Exception as error:
            log.warning("mosaic_failed", collection=name, error=str(error))
        await asyncio.sleep(every)
