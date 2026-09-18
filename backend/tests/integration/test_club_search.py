from urllib.parse import parse_qs, urlsplit

import pytest


def _search(api, q: str) -> list[dict]:
    return api.get("/api/club/films", params={"q": q}).json()["films"]


def _thumb(api, q: str) -> str:
    return _search(api, q)[0]["thumb_url"]


@pytest.mark.parametrize(
    ("q", "asked"),
    [
        pytest.param('"M"', "exact:M", id="quoted"),
        pytest.param('"m', "exact:m", id="still-typing"),
        pytest.param("“M”", "exact:M", id="curly-quotes"),
    ],
)
def test_quotes_find_a_one_letter_title(api, fake_emby, q, asked):
    assert [film["title"] for film in _search(api, q)] == ["M"]
    assert fake_emby.search_calls == [asked]


def test_without_quotes_one_letter_finds_nothing(api, fake_emby):
    assert _search(api, "M") == []
    assert fake_emby.search_calls == []


def test_an_exact_title_that_is_not_there(api):
    assert _search(api, '"Blood"') == []


def test_search_results_carry_no_trailer(api):
    assert "trailer_url" not in _search(api, "blood")[0]


def test_a_thumb_is_fetched_once_then_served_from_disk(api, fake_emby):
    url = _thumb(api, "blood")
    first, second = api.get(url), api.get(url)
    assert (first.status_code, first.headers["content-type"]) == (200, "image/webp")
    assert "immutable" in first.headers["cache-control"]
    assert second.content == first.content
    assert fake_emby.image_calls == [("m1", "tag-m1")]


def test_a_cached_thumb_survives_emby_going_away(api, fake_emby):
    url = _thumb(api, "blood")
    api.get(url)
    fake_emby.down = True
    assert api.get(url).status_code == 200


def test_an_uncached_thumb_needs_emby(api, fake_emby):
    url = _thumb(api, "blood")
    fake_emby.down = True
    assert api.get(url).status_code == 502


def _tampered(url: str, **changes) -> str:
    parts = urlsplit(url)
    params = {key: values[0] for key, values in parse_qs(parts.query).items()}
    query = "&".join(f"{key}={value}" for key, value in {**params, **changes}.items())
    return f"{parts.path}?{query}"


@pytest.mark.parametrize(
    "changes",
    [
        pytest.param({"sig": "0" * 24}, id="forged-signature"),
        pytest.param({"tag": "someone-elses-photo"}, id="other-tag"),
    ],
)
def test_only_signed_thumbs_are_served(api, fake_emby, changes):
    url = _tampered(_thumb(api, "blood"), **changes)
    assert api.get(url).status_code == 404
    assert fake_emby.image_calls == []


def test_an_other_item_with_a_valid_looking_url_is_refused(api, fake_emby):
    url = _thumb(api, "blood").replace("/films/m1/", "/films/m2/")
    assert api.get(url).status_code == 404


def test_a_film_without_a_poster_has_no_thumb(api):
    assert _search(api, "no poster")[0]["thumb_url"] is None


def test_thumb_parameters_are_required(api):
    assert api.get("/api/club/films/m1/thumb").status_code == 422
