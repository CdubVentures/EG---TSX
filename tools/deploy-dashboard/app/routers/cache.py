"""
Cache purge endpoint.

POST /api/cache/purge — deletes .astro/ and node_modules/.vite/ directories.
No build triggered, instant JSON response.
"""

from __future__ import annotations

import logging
import shutil

from fastapi import APIRouter, HTTPException

from config import AppConfig
from services.watcher import clear_site_publish_markers

logger = logging.getLogger("deploy-dashboard.cache")

router = APIRouter()


def purge_cache(config: AppConfig) -> dict:
    """Delete cache directories. Returns what was cleared."""
    cleared: list[str] = []

    if config.astro_cache_dir.exists():
        shutil.rmtree(config.astro_cache_dir)
        cleared.append(".astro")

    if config.vite_cache_dir.exists():
        shutil.rmtree(config.vite_cache_dir)
        cleared.append("node_modules/.vite")

    reset_markers = clear_site_publish_markers(config)

    return {
        "success": True,
        "cleared": cleared,
        "resetMarkers": reset_markers,
        "message": "Local cache state reset" if cleared or reset_markers else "Cache already clean",
    }


@router.post("/cache/purge")
async def cache_purge():
    from main import config

    logger.info("Cache purge requested")
    try:
        result = purge_cache(config)
        logger.info("Cache purge result: %s", result["cleared"])
        return result
    except OSError as exc:
        logger.error("Cache purge failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
