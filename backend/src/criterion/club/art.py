import asyncio
import hashlib
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from criterion.emby.auth import EmbyUnavailable

ART_WIDTH = 600
THUMB_SIZE = (128, 192)
THUMB = "-t"
MAX_BYTES = 12 * 1024 * 1024
TIMEOUT = 15.0
FAILURES = (
    httpx.HTTPError,
    EmbyUnavailable,
    OSError,
    ValueError,
    UnidentifiedImageError,
    Image.DecompressionBombError,
)


def art_dir(data_dir: Path) -> Path:
    return data_dir / "club-art"


def art_path(data_dir: Path, version: str, variant: str = "") -> Path:
    return art_dir(data_dir) / f"{version}{variant}.webp"


def art_url(version: str | None, variant: str = "") -> str | None:
    return f"/api/club-art/{version}{variant}.webp" if version else None


def emby_version(item_id: str, image_tag: str) -> str:
    return hashlib.sha1(f"emby:{item_id}:{image_tag}".encode()).hexdigest()[:12]


def _write(raw: bytes, data_dir: Path, version: str) -> None:
    image = Image.open(BytesIO(raw)).convert("RGB")
    poster = image.copy()
    poster.thumbnail((ART_WIDTH, ART_WIDTH * 2), Image.Resampling.LANCZOS)
    art_dir(data_dir).mkdir(parents=True, exist_ok=True)
    poster.save(art_path(data_dir, version), "WEBP", quality=82)
    ImageOps.fit(image, THUMB_SIZE, Image.Resampling.LANCZOS).save(
        art_path(data_dir, version, THUMB), "WEBP", quality=82
    )


async def _download(url: str, transport: httpx.AsyncBaseTransport | None) -> bytes:
    async with httpx.AsyncClient(
        timeout=TIMEOUT, follow_redirects=True, transport=transport
    ) as client:
        response = await client.get(url, headers={"User-Agent": "CriterionClub/1.0"})
        response.raise_for_status()
    if len(response.content) > MAX_BYTES:
        raise ValueError("image is too large")
    return response.content


async def cache_url(
    url: str,
    data_dir: Path,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str | None:
    try:
        raw = await _download(url, transport)
        version = hashlib.sha1(raw).hexdigest()[:12]
        await asyncio.to_thread(_write, raw, data_dir, version)
    except FAILURES:
        version = None
    return version


async def cache_emby(client, item_id: str, image_tag: str, data_dir: Path) -> str | None:
    version = emby_version(item_id, image_tag)
    held = art_path(data_dir, version).exists()
    try:
        raw = None if held else await client.image_bytes(item_id, image_tag, ART_WIDTH)
        await asyncio.to_thread(_write, raw, data_dir, version) if raw else None
        version = version if held or raw else None
    except FAILURES:
        version = None
    return version
