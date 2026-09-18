import pytest
from pydantic import ValidationError

from criterion.config import Settings

REQUIRED = {"emby_server_url": "emby.test:8096", "emby_server_api": "key"}


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        pytest.param("info", "INFO", id="lower-case"),
        pytest.param(" Warning ", "WARNING", id="padded"),
        pytest.param("DEBUG", "DEBUG", id="upper-case"),
    ],
)
def test_log_level_is_normalised(given, expected):
    assert Settings(**REQUIRED, log_level=given).log_level == expected


def test_an_unknown_log_level_is_refused():
    with pytest.raises(ValidationError):
        Settings(**REQUIRED, log_level="LOUD")


def test_a_bare_host_gets_a_scheme():
    assert Settings(**REQUIRED).emby_base == "http://emby.test:8096"
