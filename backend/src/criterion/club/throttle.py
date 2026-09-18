from dataclasses import dataclass, field


class TooManyAttempts(Exception):
    pass


@dataclass
class Throttle:
    limit: int = 8
    window: float = 600.0
    _failures: dict[str, list[float]] = field(default_factory=dict)

    def _recent(self, key: str, now: float) -> list[float]:
        recent = [at for at in self._failures.get(key, []) if now - at < self.window]
        self._failures[key] = recent
        return recent

    def check(self, keys: list[str], now: float) -> None:
        if any(len(self._recent(key, now)) >= self.limit for key in keys):
            raise TooManyAttempts

    def record(self, keys: list[str], now: float) -> None:
        for key in keys:
            self._recent(key, now).append(now)

    def clear(self, keys: list[str]) -> None:
        for key in keys:
            self._failures.pop(key, None)
