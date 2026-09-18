import asyncio
import hashlib
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import httpx
import structlog
from PIL import Image, ImageOps, UnidentifiedImageError

from criterion.emby.auth import EmbyUnavailable

log = structlog.get_logger()

ART_WIDTH = 600
THUMB_SIZE = (128, 192)
THUMB = "-t"
PREVIEW = "-og"
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


def preview_path(data_dir: Path, version: str) -> Path:
    return art_dir(data_dir) / f"{version}{PREVIEW}.jpg"


def preview_url(version: str) -> str:
    return f"/api/club-art/{version}{PREVIEW}.jpg"


def emby_version(item_id: str, image_tag: str) -> str:
    return hashlib.sha1(f"emby:{item_id}:{image_tag}".encode()).hexdigest()[:12]


def is_held(data_dir: Path, version: str) -> bool:
    return all(art_path(data_dir, version, variant).exists() for variant in ("", THUMB))


def save_atomically(image: Image.Image, path: Path, fmt: str = "WEBP", **options) -> None:
    partial = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    image.save(partial, fmt, **options)
    partial.replace(path)


def _write(raw: bytes, data_dir: Path, version: str) -> None:
    image = Image.open(BytesIO(raw)).convert("RGB")
    poster = image.copy()
    poster.thumbnail((ART_WIDTH, ART_WIDTH * 2), Image.Resampling.LANCZOS)
    art_dir(data_dir).mkdir(parents=True, exist_ok=True)
    thumb = ImageOps.fit(image, THUMB_SIZE, Image.Resampling.LANCZOS)
    save_atomically(poster, art_path(data_dir, version), quality=82)
    save_atomically(thumb, art_path(data_dir, version, THUMB), quality=82)
    save_atomically(poster, preview_path(data_dir, version), "JPEG", quality=85)


def _preview_from_poster(data_dir: Path, version: str) -> None:
    with Image.open(art_path(data_dir, version)) as poster:
        save_atomically(poster.convert("RGB"), preview_path(data_dir, version), "JPEG", quality=85)


def ensure_preview(data_dir: Path, version: str) -> bool:
    # Art saved before previews existed gets its JPEG on first use, from the local poster only.
    missing = not preview_path(data_dir, version).exists()
    _preview_from_poster(data_dir, version) if missing and art_path(
        data_dir, version
    ).exists() else None
    return preview_path(data_dir, version).exists()


async def _capped(response: httpx.Response) -> bytes:
    chunks, size = [], 0
    async for chunk in response.aiter_bytes():
        size += len(chunk)
        if size > MAX_BYTES:
            raise ValueError("image is too large")
        chunks.append(chunk)
    return b"".join(chunks)


async def _download(url: str, transport: httpx.AsyncBaseTransport | None) -> bytes:
    async with (
        httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True, transport=transport) as client,
        client.stream("GET", url, headers={"User-Agent": "CriterionClub/1.0"}) as response,
    ):
        response.raise_for_status()
        raw = await _capped(response)
    return raw


async def cache_url(
    url: str,
    data_dir: Path,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str | None:
    try:
        raw = await _download(url, transport)
        version = hashlib.sha1(raw).hexdigest()[:12]
        await asyncio.to_thread(_write, raw, data_dir, version)
    except FAILURES as error:
        log.warning("art_fetch_failed", source="url", url=url, error=str(error))
        version = None
    return version


async def cache_emby(client, item_id: str, image_tag: str, data_dir: Path) -> str | None:
    version = emby_version(item_id, image_tag)
    held = is_held(data_dir, version)
    try:
        raw = None if held else await client.image_bytes(item_id, image_tag, ART_WIDTH)
        await asyncio.to_thread(_write, raw, data_dir, version) if raw else None
        version = version if held or raw else None
    except FAILURES as error:
        log.warning("art_fetch_failed", source="emby", item_id=item_id, error=str(error))
        version = None
    return version
