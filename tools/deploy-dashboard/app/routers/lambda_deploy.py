"""
Real Lambda deployment endpoint.

Streams the repo's real deploy-aws.mjs lambda-only workflow into SSE events
that the dashboard can render as operator-facing milestones.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import re
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
from services.watcher import touch_lambda_sync_marker

logger = logging.getLogger("deploy-dashboard.lambda")

router = APIRouter()

_lambda_lock = asyncio.Lock()

_STAGE_MAP = {
    "stage-lambda": "lambda-package",
    "upload-lambda": "lambda-upload",
    "deploy-stack": "lambda-deploy",
    "read-stack": "lambda-live",
}


def _get_config() -> AppConfig:
    from main import config
    return config


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def build_lambda_deploy_args(_config: AppConfig) -> list[str]:
    deploy_script = to_command_path(_config.deploy_script_path, cwd=_config.project_root)

    return [
        "node",
        deploy_script,
        "--skip-build",
        "--skip-static",
        "--skip-invalidate",
    ]


def build_hidden_popen_kwargs() -> dict:
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


def _parse_deploy_event(line: str) -> dict | None:
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict) or payload.get("egTsxEvent") is not True:
        return None

    stage = _STAGE_MAP.get(payload.get("stage", ""))
    if stage is None:
        return None

    return {
        "stage": stage,
        "status": payload.get("status", ""),
        "label": payload.get("label", stage),
    }


def _resolve_tool_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _build_subprocess_env() -> dict[str, str]:
    """Build subprocess env from os.environ + .env.deploy values."""
    env = os.environ.copy()
    env["EG_TSX_EVENT_STREAM"] = "1"

    # Inject .env.deploy values so deploy-aws.mjs can read them as process.env
    env_file = parse_env_file(_resolve_tool_root() / ".env.deploy")
    for key, value in env_file.items():
        if key not in env:  # real env vars take precedence
            env[key] = value

    return env


async def stream_lambda_deploy(config: AppConfig) -> AsyncGenerator[SSELine, None]:
    args = build_lambda_deploy_args(config)
    env = _build_subprocess_env()

    logger.info("Lambda deploy requested: %s", " ".join(args))

    proc = subprocess.Popen(
        args,
        cwd=str(config.project_root),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        shell=False,
        env=env,
        **build_hidden_popen_kwargs(),
    )

    event_queue: queue.Queue = queue.Queue()
    threads = [
        threading.Thread(target=_read_stream, args=(proc.stdout, event_queue, "stdout"), daemon=True),
        threading.Thread(target=_read_stream, args=(proc.stderr, event_queue, "stderr"), daemon=True),
    ]
    for thread in threads:
        thread.start()

    closed = 0
    active_stage = "lambda-package"

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

        deploy_event = _parse_deploy_event(text)
        if deploy_event is not None:
            active_stage = deploy_event["stage"]
            verb = "Starting" if deploy_event["status"] == "started" else "Completed"
            yield SSELine(
                stage=deploy_event["stage"],
                source="system",
                line=f"{verb}: {deploy_event['label']}",
                timestamp=_now_iso(),
            )
            continue

        yield SSELine(
            stage=active_stage,
            source=source,
            line=text,
            timestamp=_now_iso(),
        )

    exit_code = proc.wait()
    logger.info("Lambda deploy exited with code %d", exit_code)

    if exit_code != 0:
        yield SSELine(
            stage=active_stage,
            source="system",
            line=f"FAILED with exit code {exit_code}",
            timestamp=_now_iso(),
        )
        raise subprocess.CalledProcessError(exit_code, args)


@router.post("/lambda/deploy")
async def api_lambda_deploy():
    if _lambda_lock.locked():
        raise HTTPException(409, "A lambda deploy is already running")

    config = _get_config()

    async def event_stream():
        async with _lambda_lock:
            started_at = _now_iso()
            started_perf = time.perf_counter()
            lambda_version = None
            try:
                async for sse_line in stream_lambda_deploy(config):
                    version_match = re.search(r"\bv(\d+)\b", sse_line.line)
                    if version_match is not None:
                        lambda_version = int(version_match.group(1))
                    yield format_sse_line(sse_line)

                touch_lambda_sync_marker(config)
                record_deploy_run(
                    kind="lambda",
                    label="Lambda",
                    status="success",
                    started_at=started_at,
                    completed_at=_now_iso(),
                    duration_seconds=time.perf_counter() - started_perf,
                    pages_built=0,
                    uploaded=0,
                    deleted=0,
                    cdn_paths=0,
                    lambda_version=lambda_version,
                )
                yield format_sse({
                    "stage": "done",
                    "source": "system",
                    "line": "Lambda deploy complete",
                    "timestamp": _now_iso(),
                })
            except subprocess.CalledProcessError:
                record_deploy_run(
                    kind="lambda",
                    label="Lambda",
                    status="failed",
                    started_at=started_at,
                    completed_at=_now_iso(),
                    duration_seconds=time.perf_counter() - started_perf,
                    pages_built=0,
                    uploaded=0,
                    deleted=0,
                    cdn_paths=0,
                    lambda_version=lambda_version,
                )
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")
