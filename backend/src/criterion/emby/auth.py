from contextlib import suppress

import httpx

from criterion.emby.models import EmbyUser

AUTHORIZATION = (
    'MediaBrowser Client="There Will Be Cinema", Device="Web", '
    'DeviceId="there-will-be-cinema-web", Version="1.0.0"'
)
TIMEOUT = 15.0


class InvalidLogin(Exception):
    pass


class EmbyUnavailable(Exception):
    pass


def _failure(response: httpx.Response) -> type[Exception] | None:
    rejected = {401: InvalidLogin, 403: InvalidLogin}
    return rejected.get(response.status_code, EmbyUnavailable if response.is_error else None)


def _body(response: httpx.Response) -> dict:
    failure = _failure(response)
    if failure:
        raise failure(response.text[:200])
    try:
        body = response.json()
    except ValueError as error:
        raise EmbyUnavailable("emby answered with something other than json") from error
    return body


def _user(body: dict) -> EmbyUser:
    user = body.get("User") or {}
    if not user.get("Id") or not user.get("Name"):
        raise EmbyUnavailable("emby did not describe the user")
    return EmbyUser(id=str(user["Id"]), name=str(user["Name"]))


async def _end_session(client: httpx.AsyncClient, token: str | None) -> None:
    with suppress(httpx.HTTPError):
        await client.post("/Sessions/Logout", headers={"X-Emby-Token": token}) if token else None


async def authenticate(
    base_url: str,
    username: str,
    password: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> EmbyUser:
    try:
        async with httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"X-Emby-Authorization": AUTHORIZATION},
            timeout=TIMEOUT,
            transport=transport,
        ) as client:
            response = await client.post(
                "/Users/AuthenticateByName", json={"Username": username, "Pw": password}
            )
            body = _body(response)
            user = _user(body)
            await _end_session(client, body.get("AccessToken"))
    except httpx.HTTPError as error:
        raise EmbyUnavailable(str(error)) from error
    return user
