from __future__ import annotations

from fastapi import APIRouter

from services.system_health import read_system_health

router = APIRouter()


def _get_config():
    from main import config
    return config


@router.get("/system/health")
async def system_health():
    return read_system_health(_get_config())
