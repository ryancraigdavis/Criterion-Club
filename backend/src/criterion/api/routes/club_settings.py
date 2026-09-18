from fastapi import APIRouter, Request
from pydantic import BaseModel

from criterion.api.deps import conn_of, require_admin, require_same_site
from criterion.db import repo

router = APIRouter(tags=["club-settings"])

SHOW_SCHEDULE = "club_show_schedule"


class SettingsIn(BaseModel):
    show_schedule: bool


@router.get("/club/settings")
async def club_settings(request: Request) -> dict:
    return {"show_schedule": repo.get_meta(conn_of(request), SHOW_SCHEDULE) != "off"}


@router.post("/club/admin/settings")
async def save_settings(request: Request, body: SettingsIn) -> dict:
    require_same_site(request)
    require_admin(request)
    repo.set_meta(conn_of(request), SHOW_SCHEDULE, "on" if body.show_schedule else "off")
    return {"show_schedule": body.show_schedule}
