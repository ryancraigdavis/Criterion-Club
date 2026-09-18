import pytest

from criterion.club import search


@pytest.mark.parametrize(
    ("raw", "term", "exact"),
    [
        pytest.param("blood", "blood", False, id="plain"),
        pytest.param('"M"', "M", True, id="quoted"),
        pytest.param('"M', "M", True, id="still-typing"),
        pytest.param("“Ran”", "Ran", True, id="curly-quotes"),
        pytest.param('  " Heat "  ', "Heat", True, id="padded"),
        pytest.param("'Round Midnight", "'Round Midnight", False, id="apostrophe-is-a-title"),
        pytest.param("", "", False, id="empty"),
    ],
)
def test_parse(raw, term, exact):
    assert search.parse(raw) == search.Query(term=term, exact=exact)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param("b", False, id="one-letter"),
        pytest.param("bl", True, id="two-letters"),
        pytest.param('"M"', True, id="one-letter-exact"),
        pytest.param('""', False, id="empty-quotes"),
        pytest.param('"', False, id="lone-quote"),
    ],
)
def test_searchable(raw, expected):
    assert search.searchable(search.parse(raw)) is expected
