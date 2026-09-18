import pytest

from criterion.club.throttle import Throttle, TooManyAttempts

KEYS = ["ip:1.2.3.4", "user:ryan"]


@pytest.fixture
def throttle() -> Throttle:
    return Throttle(limit=3, window=60.0)


def test_allows_attempts_under_the_limit(throttle):
    throttle.record(KEYS, 0.0)
    throttle.record(KEYS, 1.0)
    throttle.check(KEYS, 2.0)


def test_blocks_at_the_limit(throttle):
    for at in (0.0, 1.0, 2.0):
        throttle.record(KEYS, at)
    with pytest.raises(TooManyAttempts):
        throttle.check(KEYS, 3.0)


@pytest.mark.parametrize(
    "keys",
    [pytest.param(["ip:1.2.3.4"], id="same-address"), pytest.param(["user:ryan"], id="same-user")],
)
def test_either_key_trips_the_limit(throttle, keys):
    for at in (0.0, 1.0, 2.0):
        throttle.record(KEYS, at)
    with pytest.raises(TooManyAttempts):
        throttle.check(keys, 3.0)


def test_failures_age_out(throttle):
    for at in (0.0, 1.0, 2.0):
        throttle.record(KEYS, at)
    throttle.check(KEYS, 62.5)


def test_success_clears_the_count(throttle):
    for at in (0.0, 1.0, 2.0):
        throttle.record(KEYS, at)
    throttle.clear(KEYS)
    throttle.check(KEYS, 3.0)


def test_idle_keys_are_forgotten(throttle):
    throttle.record(["ip:1.2.3.4"], 0.0)
    throttle.record(["ip:5.6.7.8"], 100.0)
    assert list(throttle._failures) == ["ip:5.6.7.8"]
