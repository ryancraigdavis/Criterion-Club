import base64
import binascii
import hashlib
import hmac
import json
from dataclasses import dataclass

COOKIE = "club_session"
TTL_SECONDS = 30 * 24 * 3600


@dataclass(frozen=True)
class Session:
    uid: str
    name: str
    exp: int


def _encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _tag(body: str, secret: str) -> str:
    return _encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())


def issue(uid: str, name: str, secret: str, now: float, ttl: int = TTL_SECONDS) -> str:
    payload = {"uid": uid, "name": name, "exp": int(now) + ttl}
    body = _encode(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_tag(body, secret)}"


def _payload(body: str) -> Session:
    try:
        data = json.loads(_decode(body))
        session = Session(uid=str(data["uid"]), name=str(data["name"]), exp=int(data["exp"]))
    except (binascii.Error, KeyError, TypeError, ValueError) as error:
        raise ValueError("malformed session") from error
    return session


def read(token: str, secret: str, now: float) -> Session:
    body, _, tag = token.partition(".")
    signed = bool(secret) and hmac.compare_digest(tag.encode(), _tag(body, secret).encode())
    if not signed:
        raise ValueError("unsigned session")
    session = _payload(body)
    if session.exp <= now:
        raise ValueError("expired session")
    return session


def is_admin(session: Session | None, admins: frozenset[str]) -> bool:
    return session is not None and session.name.casefold() in admins
