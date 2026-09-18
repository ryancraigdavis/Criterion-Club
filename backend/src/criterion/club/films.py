from pathlib import Path

from criterion.club import art


class FilmProblem(ValueError):
    pass


async def _library(client, data_dir: Path, item_id: str, *_: object) -> dict:
    film = await client.lookup(item_id)
    # Emby answers some unknown ids with an unrelated film, so trust only an exact id match.
    if film is None or film.item_id != item_id:
        raise FilmProblem("that film is not in the library")
    version = film.image_tag and await art.cache_emby(client, item_id, film.image_tag, data_dir)
    return {
        "item_id": film.item_id,
        "title": film.title,
        "year": film.year,
        "overview": film.overview,
        "runtime_min": film.runtime_min,
        "art_version": version or None,
        "trailer_url": film.trailer_url,
    }


async def _typed(_: object, __: Path, ___: str | None, title: str, year: int | None) -> dict:
    if not title.strip():
        raise FilmProblem("give the film a title")
    return {
        "item_id": None,
        "title": title.strip(),
        "year": year,
        "overview": None,
        "runtime_min": None,
        "art_version": None,
        "trailer_url": None,
    }


async def resolve(
    client,
    data_dir: Path,
    item_id: str | None,
    title: str,
    year: int | None,
) -> dict:
    source = _library if item_id else _typed
    return await source(client, data_dir, item_id, title, year)
