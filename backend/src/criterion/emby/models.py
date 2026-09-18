from pydantic import BaseModel


class EmbyUser(BaseModel, frozen=True):
    id: str
    name: str


class Film(BaseModel, frozen=True):
    item_id: str
    title: str
    year: int | None = None
    overview: str | None = None
    runtime_min: int | None = None
    image_tag: str | None = None
    trailer_url: str | None = None
