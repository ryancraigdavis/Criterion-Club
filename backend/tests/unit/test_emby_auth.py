import json

import httpx
import pytest

from criterion.emby.auth import AUTHORIZATION, EmbyUnavailable, InvalidLogin, authenticate
from criterion.emby.client import EmbyClient
from criterion.emby.models import EmbyUser

OK_BODY = {
    "User": {"Id": "u1", "Name": "Ryan", "Policy": {"IsAdministrator": True}},
    "AccessToken": "user-token",
    "ServerId": "server-1",
}


def _transport(calls: list[httpx.Request], login: httpx.Response) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return login if request.url.path == "/Users/AuthenticateByName" else httpx.Response(204)

    return httpx.MockTransport(handler)


async def test_returns_the_user_and_ends_the_emby_session():
    calls: list[httpx.Request] = []
    transport = _transport(calls, httpx.Response(200, json=OK_BODY))
    user = await authenticate("http://emby.test/", "Ryan", "pw", transport)
    assert user == EmbyUser(id="u1", name="Ryan")
    login, logout = calls
    assert json.loads(login.content) == {"Username": "Ryan", "Pw": "pw"}
    assert login.headers["X-Emby-Authorization"] == AUTHORIZATION
    assert "X-Emby-Token" not in login.headers
    assert (logout.url.path, logout.headers["X-Emby-Token"]) == ("/Sessions/Logout", "user-token")


@pytest.mark.parametrize(
    ("response", "error"),
    [
        pytest.param(httpx.Response(401, text="Invalid username"), InvalidLogin, id="rejected"),
        pytest.param(httpx.Response(403, text="Disabled"), InvalidLogin, id="disabled"),
        pytest.param(httpx.Response(500, text="boom"), EmbyUnavailable, id="server-error"),
        pytest.param(httpx.Response(200, text="<html>"), EmbyUnavailable, id="not-json"),
        pytest.param(httpx.Response(200, json={"User": {}}), EmbyUnavailable, id="no-user"),
    ],
)
async def test_failures(response, error):
    with pytest.raises(error):
        await authenticate("http://emby.test", "Ryan", "pw", _transport([], response))


async def test_unreachable_server():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(EmbyUnavailable):
        await authenticate("http://emby.test", "Ryan", "pw", httpx.MockTransport(handler))


async def test_logout_failure_does_not_fail_the_login():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/Sessions/Logout":
            raise httpx.ConnectError("gone", request=request)
        return httpx.Response(200, json=OK_BODY)

    user = await authenticate("http://emby.test", "Ryan", "pw", httpx.MockTransport(handler))
    assert user.name == "Ryan"


async def test_client_login_skips_the_admin_token():
    calls: list[httpx.Request] = []
    transport = _transport(calls, httpx.Response(200, json=OK_BODY))
    client = EmbyClient("http://emby.test", "admin-key", transport=transport)
    assert (await client.authenticate("Ryan", "pw")).id == "u1"
    assert "X-Emby-Token" not in calls[0].headers
    await client.close()
