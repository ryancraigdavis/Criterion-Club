import asyncio
import hashlib
import hmac
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlencode

from PIL import Image, ImageOps

from criterion.club import art

SMALL = "-s"
SIZE = (64, 96)
FETCH_WIDTH = 128


def _key(secret: str) -> bytes:
    return hashlib.sha256(b"criterion-club/film-thumbs\0" + secret.encode()).digest()


def signature(secret: str, item_id: str, tag: str) -> str:
    return hmac.new(_key(secret), f"{item_id}:{tag}".encode(), hashlib.sha256).hexdigest()[:24]


def valid(secret: str, item_id: str, tag: str, sig: str) -> bool:
    return hmac.compare_digest(signature(secret, item_id, tag), sig)


def thumb_url(secret: str, item_id: str, tag: str | None) -> str | None:
    query = urlencode({"tag": tag, "sig": signature(secret, item_id, tag or "")})
    return f"/api/club/films/{quote(item_id, safe='')}/thumb?{query}" if tag else None


def path_for(data_dir: Path, item_id: str, tag: str) -> Path:
    return art.art_path(data_dir, art.emby_version(item_id, tag), SMALL)


def _write(raw: bytes, path: Path) -> None:
    image = Image.open(BytesIO(raw)).convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    art.save_atomically(ImageOps.fit(image, SIZE, Image.Resampling.LANCZOS), path, quality=80)


async def ensure(client, data_dir: Path, item_id: str, tag: str) -> Path | None:
    path = path_for(data_dir, item_id, tag)
    raw = None if path.exists() else await client.image_bytes(item_id, tag, FETCH_WIDTH)
    await asyncio.to_thread(_write, raw, path) if raw else None
    return path if path.exists() else None
