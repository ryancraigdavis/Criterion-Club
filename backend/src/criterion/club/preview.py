import sqlite3
from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

SITE_NAME = "Criterion Club"
CARD = {"path": "/og-card.png", "width": 1200, "height": 630}
DEFAULT = {
    "title": SITE_NAME,
    "description": "Screenings, RSVPs and polls for the club.",
    "image": CARD,
}


def when_text(starts_at: str, zone: ZoneInfo) -> str:
    local = datetime.fromisoformat(starts_at).astimezone(zone)
    hour = local.hour % 12 or 12
    half = "AM" if local.hour < 12 else "PM"
    return f"{local:%A, %B} {local.day} at {hour}:{local:%M} {half}"


def film_name(row: sqlite3.Row) -> str:
    return f"{row['title']} ({row['year']})" if row["year"] else row["title"]


def for_screening(row: sqlite3.Row, zone: ZoneInfo, image: dict) -> dict:
    details = [f"Next screening: {when_text(row['starts_at'], zone)}", row["location"]]
    return {
        "title": f"{film_name(row)} · {SITE_NAME}",
        "description": " · ".join(part for part in details if part),
        "image": image,
    }


def _tag(kind: str, key: str, value: str | int) -> str:
    return f'<meta {kind}="{key}" content="{escape(str(value))}" />'


def meta_tags(preview: dict, site_url: str) -> str:
    image = preview["image"]
    sized = [("og:image:width", image.get("width")), ("og:image:height", image.get("height"))]
    tags = [
        _tag("property", "og:type", "website"),
        _tag("property", "og:site_name", SITE_NAME),
        _tag("property", "og:url", site_url),
        _tag("property", "og:title", preview["title"]),
        _tag("property", "og:description", preview["description"]),
        _tag("property", "og:image", f"{site_url}{image['path']}"),
        *(_tag("property", key, value) for key, value in sized if value),
        _tag("name", "twitter:card", "summary_large_image"),
        _tag("name", "twitter:title", preview["title"]),
        _tag("name", "twitter:description", preview["description"]),
        _tag("name", "twitter:image", f"{site_url}{image['path']}"),
    ]
    return "\n".join(tags) + "\n"
