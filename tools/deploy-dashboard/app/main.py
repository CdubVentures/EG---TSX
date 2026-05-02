"""
EG Deploy Dashboard — FastAPI backend.

Runs locally on the office server. Executes Astro builds and AWS S3 syncs,
streaming terminal output to the React frontend via Server-Sent Events.
Serves the dashboard UI at http://localhost:8420.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response

from config import load_config

logger = logging.getLogger("deploy-dashboard")

config = load_config()

_THIS_DIR = Path(__file__).parent
_TOOL_ROOT = _THIS_DIR.parent
_BUNDLE_PATH = _TOOL_ROOT / "ui" / "app.bundle.js"
_SETTINGS_PATH = _TOOL_ROOT / "ui" / "settings.json"


_HTML_PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EG Deploy Dashboard</title>
  <style>html,body{margin:0;height:100%;background:#080c18;overflow:hidden;}#root{height:100%;overflow:auto;}</style>
</head>
<body>
  <div id="root"></div>
  <script src="/app.bundle.js"></script>
</body>
</html>
"""


def _validate_environment() -> None:
    """Check that required tools exist. Runs once at startup."""
    pkg_json = config.project_root / "package.json"
    if not pkg_json.is_file():
        raise RuntimeError(f"package.json not found in {config.project_root}")
    logger.info("Found package.json at %s", pkg_json)

    # npm (required) — PATH lookup only, no subprocess
    if not shutil.which("npm"):
        raise RuntimeError("npm not found on PATH — cannot run builds")

    # aws CLI (warn only) — PATH lookup only, no subprocess
    if not shutil.which("aws"):
        logger.warning("AWS CLI not found on PATH — S3 sync will fail")

    # Check bundle exists
    if not _BUNDLE_PATH.is_file():
        raise RuntimeError(
            "app.bundle.js not found. Run: "
            "npx esbuild tools/deploy-dashboard/ui/_entry.jsx --bundle --format=iife "
            "--jsx=transform --charset=utf8 --minify "
            "--outfile=tools/deploy-dashboard/ui/app.bundle.js"
        )
    logger.info("Dashboard bundle: %s (%d KB)", _BUNDLE_PATH.name,
                _BUNDLE_PATH.stat().st_size // 1024)


def _log_tool_versions() -> None:
    """Log tool versions in background thread — non-blocking."""
    try:
        result = subprocess.run(
            ["npm", "--version"], capture_output=True, text=True, shell=True
        )
        if result.returncode == 0:
            logger.info("npm %s", result.stdout.strip())
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["aws", "--version"], capture_output=True, text=True, shell=True
        )
        if result.returncode == 0:
            logger.info("AWS CLI: %s", result.stdout.strip().split("\n")[0])
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # ── startup ──
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
        datefmt="%H:%M:%S",
    )
    logger.info("Deploy Dashboard starting — project_root=%s", config.project_root)
    logger.info("S3 bucket=%s  region=%s", config.s3_bucket, config.aws_region)
    if config.cloudfront_distribution_id:
        logger.info("CloudFront distribution=%s", config.cloudfront_distribution_id)
    else:
        logger.warning("No CloudFront distribution ID configured — CDN invalidation will be skipped")
    _validate_environment()
    threading.Thread(target=_log_tool_versions, daemon=True).start()

    yield

    # ── shutdown ──
    from services.runner import kill_active_process

    killed = kill_active_process()
    if killed:
        logger.info("Terminated active subprocess on shutdown")
    logger.info("Deploy Dashboard stopped")


app = FastAPI(title="EG Deploy Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.build import router as build_router
from routers.cache import router as cache_router
from routers.cdn import router as cdn_router
from routers.deploy_history import router as deploy_history_router
from routers.infra_status import router as infra_status_router
from routers.lambda_catalog import router as lambda_catalog_router
from routers.db_sync import router as db_sync_router
from routers.lambda_deploy import router as lambda_deploy_router
from routers.status import router as status_router
from routers.system_health import router as system_health_router
from routers.simulate import router as simulate_router

app.include_router(build_router, prefix="/api")
app.include_router(cache_router, prefix="/api")
app.include_router(db_sync_router, prefix="/api")
app.include_router(cdn_router, prefix="/api")
app.include_router(deploy_history_router, prefix="/api")
app.include_router(infra_status_router, prefix="/api")
app.include_router(lambda_catalog_router, prefix="/api")
app.include_router(lambda_deploy_router, prefix="/api")
app.include_router(status_router, prefix="/api")
app.include_router(system_health_router, prefix="/api")
app.include_router(simulate_router, prefix="/api")


@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    return _HTML_PAGE


@app.get("/app.bundle.js")
async def serve_bundle():
    """Serve the pre-built React bundle."""
    content = _BUNDLE_PATH.read_text(encoding="utf-8")
    return Response(content=content, media_type="application/javascript")


@app.get("/api/settings")
async def get_settings():
    """Read persisted UI settings (theme, etc.) from disk."""
    try:
        data = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    return JSONResponse(data)


@app.put("/api/settings")
async def put_settings(request: Request):
    """Write UI settings to disk."""
    body = await request.json()
    # Merge with existing settings so partial updates work
    try:
        existing = json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {}
    existing.update(body)
    _SETTINGS_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    return JSONResponse(existing)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "project_root": str(config.project_root),
        "s3_bucket": config.s3_bucket,
        "aws_region": config.aws_region,
    }
