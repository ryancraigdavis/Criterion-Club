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

    def _sweep(self, now: float) -> None:
        self._failures = {
            key: times
            for key, times in self._failures.items()
            if times and now - times[-1] < self.window
        }

    def record(self, keys: list[str], now: float) -> None:
        self._sweep(now)
        for key in keys:
            self._failures[key] = [*self._recent(key, now), now]

    def clear(self, keys: list[str]) -> None:
        for key in keys:
            self._failures.pop(key, None)
