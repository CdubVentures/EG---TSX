from __future__ import annotations

from fastapi import APIRouter

from services.deploy_history import get_recent_runs

router = APIRouter()


@router.get("/deploy/history")
async def deploy_history():
    return {"runs": get_recent_runs()}
