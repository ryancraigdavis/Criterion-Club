from dataclasses import dataclass

# Only double quotes switch to an exact title: an apostrophe starts real titles ('Round Midnight).
QUOTES = '"“”«»'
MIN_TERM = 2


@dataclass(frozen=True)
class Query:
    term: str
    exact: bool


def parse(raw: str) -> Query:
    text = raw.strip()
    exact = bool(text) and text[0] in QUOTES
    return Query(term=text.strip(QUOTES).strip(), exact=exact)


def searchable(query: Query) -> bool:
    return len(query.term) >= (1 if query.exact else MIN_TERM)
