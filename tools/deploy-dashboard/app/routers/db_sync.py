"""
DB Sync endpoint.

Runs sync-db-remote.mjs as subprocess, streaming output via SSE.
Syncs product and article data to the Lambda search database (RDS).
"""

from __future__ import annotations

import asyncio
import logging
import os
import queue
import subprocess
import threading
import time
from collections.abc import AsyncGenerator
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import AppConfig, parse_env_file, to_command_path
from services.deploy_history import record_deploy_run
from services.runner import SSELine, format_sse, format_sse_line
from services.watcher import touch_db_sync_marker

logger = logging.getLogger("deploy-dashboard.db-sync")

router = APIRouter()

_db_sync_lock = asyncio.Lock()


def _get_config() -> AppConfig:
    from main import config
    return config


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _resolve_tool_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _build_hidden_popen_kwargs() -> dict:
    if os.name != "nt":
        return {}

    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = subprocess.SW_HIDE

    return {
        "creationflags": subprocess.CREATE_NO_WINDOW,
        "startupinfo": startupinfo,
    }


def _read_stream(stream, event_queue: queue.Queue, source_tag: str) -> None:
    try:
        for raw_line in iter(stream.readline, ""):
            event_queue.put((source_tag, raw_line.rstrip("\r\n")))
    finally:
        stream.close()
        event_queue.put((source_tag, None))


def _build_subprocess_env() -> dict[str, str]:
    """Build subprocess env from os.environ + .env.deploy values."""
    env = os.environ.copy()

    env_file = parse_env_file(_resolve_tool_root() / ".env.deploy")
    for key, value in env_file.items():
        if key not in env:
            env[key] = value

    return env


def _resolve_target_url(env: dict[str, str]) -> str | None:
    """Extract CloudFront domain from DEPLOY_COGNITO_CALLBACK_URL."""
    callback = env.get("DEPLOY_COGNITO_CALLBACK_URL", "")
    if not callback:
        return None
    # Strip /auth/callback to get origin
    try:
        from urllib.parse import urlparse
        parsed = urlparse(callback)
        return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return None


async def stream_db_sync(config: AppConfig) -> AsyncGenerator[SSELine, None]:
    sync_script = to_command_path(
        Path("scripts/sync-db-remote.mjs"), cwd=config.project_root
    )
    env = _build_subprocess_env()

    # Build args — pass --url if we can resolve it from .env.deploy
    args = ["node", sync_script]
    target_url = _resolve_target_url(env)
    if target_url:
        args.extend(["--url", target_url])

    logger.info("DB sync requested: %s", " ".join(args))

    yield SSELine(
        stage="db-sync",
        source="system",
        line=f"Starting: Sync Search DB → {target_url or 'auto'}",
        timestamp=_now_iso(),
    )

    proc = subprocess.Popen(
        args,
        cwd=str(config.project_root),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        shell=False,
        env=env,
        **_build_hidden_popen_kwargs(),
    )

    event_queue: queue.Queue = queue.Queue()
    threads = [
        threading.Thread(
            target=_read_stream,
            args=(proc.stdout, event_queue, "stdout"),
            daemon=True,
        ),
        threading.Thread(
            target=_read_stream,
            args=(proc.stderr, event_queue, "stderr"),
            daemon=True,
        ),
    ]
    for thread in threads:
        thread.start()

    closed = 0
    while closed < 2:
        try:
            source, text = event_queue.get(timeout=0.05)
        except queue.Empty:
            await asyncio.sleep(0.01)
            continue

        if text is None:
            closed += 1
            continue

        if not text:
            continue

        yield SSELine(
            stage="db-sync",
            source=source,
            line=text,
            timestamp=_now_iso(),
        )

    exit_code = proc.wait()
    logger.info("DB sync exited with code %d", exit_code)

    if exit_code != 0:
        yield SSELine(
            stage="db-sync",
            source="system",
            line=f"FAILED with exit code {exit_code}",
            timestamp=_now_iso(),
        )
        raise subprocess.CalledProcessError(exit_code, args)


@router.post("/db/sync")
async def api_db_sync():
    if _db_sync_lock.locked():
        raise HTTPException(409, "A DB sync is already running")

    config = _get_config()

    async def event_stream():
        async with _db_sync_lock:
            started_at = _now_iso()
            started_perf = time.perf_counter()
            try:
                async for sse_line in stream_db_sync(config):
                    yield format_sse_line(sse_line)

                touch_db_sync_marker(config)
                record_deploy_run(
                    kind="db-sync",
                    label="Schema Sync",
                    status="success",
                    started_at=started_at,
                    completed_at=_now_iso(),
                    duration_seconds=time.perf_counter() - started_perf,
                    pages_built=0,
                    uploaded=0,
                    deleted=0,
                    cdn_paths=0,
                    lambda_version=None,
                )
                yield format_sse({
                    "stage": "done",
                    "source": "system",
                    "line": "Schema sync complete",
                    "timestamp": _now_iso(),
                })
            except subprocess.CalledProcessError:
                record_deploy_run(
                    kind="db-sync",
                    label="Schema Sync",
                    status="failed",
                    started_at=started_at,
                    completed_at=_now_iso(),
                    duration_seconds=time.perf_counter() - started_perf,
                    pages_built=0,
                    uploaded=0,
                    deleted=0,
                    cdn_paths=0,
                    lambda_version=None,
                )
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")
