from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Annotated[
    Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
    BeforeValidator(lambda value: str(value).strip().upper()),
]


def _with_scheme(url: str) -> str:
    bare = url.strip().rstrip("/")
    prefix = "" if bare.startswith(("http://", "https://")) else "http://"
    return prefix + bare


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    emby_server_url: str
    emby_server_api: str

    emby_public_url: str = ""
    data_dir: Path = Path("./data")
    log_level: LogLevel = "INFO"
    log_json: bool = False
    frontend_origin: str = "http://localhost:5273"
    session_secret: str = ""
    club_admins: str = ""
    secure_cookies: bool = False

    @property
    def emby_base(self) -> str:
        return _with_scheme(self.emby_server_url)

    @property
    def emby_public(self) -> str:
        return _with_scheme(self.emby_public_url or self.emby_server_url)

    @property
    def club_admin_names(self) -> frozenset[str]:
        names = (name.strip().casefold() for name in self.club_admins.split(","))
        return frozenset(name for name in names if name)


@lru_cache
def get_settings() -> Settings:
    return Settings()
