import pytest

from criterion.club import films
from criterion.emby.models import Film

BLOOD = Film(
    item_id="131151",
    title="There Will Be Blood",
    year=2007,
    overview="Oil.",
    runtime_min=158,
    image_tag="tag-1",
)


class Stub:
    def __init__(self, film: Film | None) -> None:
        self.film = film

    async def lookup(self, item_id: str) -> Film | None:
        return self.film

    async def image_bytes(self, item_id: str, tag: str, max_width: int) -> bytes | None:
        return None


async def test_a_library_film_snapshots_its_details(tmp_path):
    fields = await films.resolve(Stub(BLOOD), tmp_path, "131151", "", None)
    assert fields == {
        "item_id": "131151",
        "title": "There Will Be Blood",
        "year": 2007,
        "overview": "Oil.",
        "runtime_min": 158,
        "art_version": None,
    }


async def test_a_missing_film_is_refused(tmp_path):
    with pytest.raises(films.FilmProblem):
        await films.resolve(Stub(None), tmp_path, "131151", "", None)


async def test_a_film_answering_to_another_id_is_refused(tmp_path):
    with pytest.raises(films.FilmProblem):
        await films.resolve(Stub(BLOOD), tmp_path, "ffffffffffffffffffffffffffffffff", "", None)


@pytest.mark.parametrize(
    ("title", "year"),
    [
        pytest.param("  Paris, Texas ", 1984, id="trimmed"),
        pytest.param("Solaris", None, id="no-year"),
    ],
)
async def test_a_typed_film_keeps_what_was_typed(tmp_path, title, year):
    fields = await films.resolve(Stub(None), tmp_path, None, title, year)
    assert (fields["title"], fields["year"], fields["item_id"]) == (title.strip(), year, None)


async def test_a_typed_film_needs_a_title(tmp_path):
    with pytest.raises(films.FilmProblem):
        await films.resolve(Stub(None), tmp_path, None, "   ", None)
