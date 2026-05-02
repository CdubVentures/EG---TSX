"""
CDN invalidation endpoints.

POST /api/cdn/invalidate      -- one-shot JSON full invalidation.
POST /api/cdn/invalidate/live -- live SSE invalidation stream using deploy-aws.mjs.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import subprocess
import threading

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import to_command_path
from services.cdn_queue import (
    clear_cdn_queue,
    get_cdn_queue_state,
    mark_cdn_queue_running,
    restore_cdn_queue_to_queued,
)
from services.deploy_history import record_deploy_run
from services.runner import SSELine, format_sse, format_sse_line

logger = logging.getLogger("deploy-dashboard.cdn")

router = APIRouter()
MANUAL_CDN_PREFLIGHT_MAX_PROGRESS = 12
MANUAL_CDN_INVALIDATION_MIN_PROGRESS = 15


class CdnPublishRequest(BaseModel):
    paths: list[str]


def _get_config():
    from main import config
    return config


def _normalize_requested_paths(paths: list[str] | None) -> list[str]:
    normalized_paths: list[str] = []
    seen_paths: set[str] = set()

    for raw_path in paths or []:
        path_value = f"{raw_path}".strip()
        if not path_value:
            continue

        normalized_path = path_value if path_value.startswith("/") else f"/{path_value}"
        if normalized_path in seen_paths:
            continue

        seen_paths.add(normalized_path)
        normalized_paths.append(normalized_path)

    return normalized_paths


def build_cdn_invalidate_live_args(
    config=None,
    *,
    invalidation_mode: str = "full",
    invalidate_paths: list[str] | None = None,
) -> list[str]:
    deploy_script = (
        to_command_path(config.deploy_script_path, cwd=config.project_root)
        if config is not None
        else "scripts/deploy-aws.mjs"
    )

    args = [
        "node",
        deploy_script,
        "--skip-build",
        "--skip-stack",
        "--skip-static",
        "--static-scope",
        "site",
        "--invalidation-mode",
        invalidation_mode,
    ]
    for invalidate_path in _normalize_requested_paths(invalidate_paths):
        args.extend(["--invalidate-path", invalidate_path])
    return args


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


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

    if payload.get("kind") == "site_stage_progress":
        return {
            "detail": payload.get("detail", ""),
            "kind": "site_stage_progress",
            "progress": payload.get("progress", 0),
            "source_stage": payload.get("stage", ""),
            "stage": "cdn",
        }

    return {
        "label": payload.get("label", "cdn"),
        "stage": "cdn",
        "status": payload.get("status", ""),
    }


def _normalize_manual_cdn_progress(source_stage: str, progress: int | float) -> int:
    normalized = max(0, min(100, round(progress)))

    if source_stage == "sync":
        return min(normalized, MANUAL_CDN_PREFLIGHT_MAX_PROGRESS)

    if source_stage == "cdn":
        if normalized >= 100:
            return 100

        scaled_range = 100 - MANUAL_CDN_INVALIDATION_MIN_PROGRESS
        return max(
            MANUAL_CDN_INVALIDATION_MIN_PROGRESS,
            MANUAL_CDN_INVALIDATION_MIN_PROGRESS + round((normalized / 100) * scaled_range),
        )

    return normalized


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


async def stream_cdn_invalidation(
    config,
    *,
    invalidation_mode: str = "full",
    invalidate_paths: list[str] | None = None,
):
    args = build_cdn_invalidate_live_args(
        config,
        invalidation_mode=invalidation_mode,
        invalidate_paths=invalidate_paths,
    )
    env = os.environ.copy()
    env["EG_TSX_EVENT_STREAM"] = "1"

    logger.info("Live CDN invalidation requested: %s", " ".join(args))

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

    active_stage = "cdn"
    closed = 0

    while closed < 2:
        try:
            source, text = event_queue.get(timeout=0.05)
        except queue.Empty:
            continue

        if text is None:
            closed += 1
            continue

        if not text:
            continue

        deploy_event = _parse_deploy_event(text)
        if deploy_event is not None:
            if deploy_event.get("kind") == "site_stage_progress":
                normalized_progress = _normalize_manual_cdn_progress(
                    deploy_event.get("source_stage", ""),
                    deploy_event["progress"],
                )
                yield format_sse({
                    "detail": deploy_event["detail"],
                    "kind": "site_stage_progress",
                    "progress": normalized_progress,
                    "source": "system",
                    "stage": deploy_event["stage"],
                    "timestamp": _now_iso(),
                })
                continue

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
    if exit_code != 0:
        yield SSELine(
            stage=active_stage,
            source="system",
            line=f"FAILED with exit code {exit_code}",
            timestamp=_now_iso(),
        )
        raise subprocess.CalledProcessError(exit_code, args)


@router.post("/cdn/invalidate")
async def cdn_invalidate():
    config = _get_config()

    if not config.cloudfront_distribution_id:
        raise HTTPException(
            status_code=400,
            detail="No CloudFront distribution ID configured (set DEPLOY_CLOUDFRONT_ID)",
        )

    logger.info(
        "CDN invalidation requested for distribution %s",
        config.cloudfront_distribution_id,
    )

    try:
        result = subprocess.run(
            [
                "aws", "cloudfront", "create-invalidation",
                "--distribution-id", config.cloudfront_distribution_id,
                "--paths", "/*",
                "--region", config.aws_region,
            ],
            capture_output=True,
            text=True,
            shell=False,
            timeout=30,
        )

        if result.returncode != 0:
            logger.error("CDN invalidation failed: %s", result.stderr)
            raise HTTPException(
                status_code=500,
                detail=f"CloudFront invalidation failed: {result.stderr.strip()}",
            )

        logger.info("CDN invalidation created successfully")
        return {
            "success": True,
            "distribution_id": config.cloudfront_distribution_id,
            "paths": ["/*"],
            "output": result.stdout.strip(),
        }

    except subprocess.TimeoutExpired:
        logger.error("CDN invalidation timed out")
        raise HTTPException(status_code=504, detail="CloudFront invalidation timed out")
    except FileNotFoundError:
        logger.error("AWS CLI not found")
        raise HTTPException(status_code=500, detail="AWS CLI not found on PATH")


@router.get("/cdn/queue")
async def cdn_queue():
    return {"queue": get_cdn_queue_state()}


@router.post("/cdn/invalidate/live")
async def cdn_invalidate_live():
    config = _get_config()

    if not config.cloudfront_distribution_id:
        raise HTTPException(
            status_code=400,
            detail="No CloudFront distribution ID configured (set DEPLOY_CLOUDFRONT_ID)",
        )

    async def event_stream():
        import time
        started_at = _now_iso()
        started_perf = time.perf_counter()
        mark_cdn_queue_running("CDN Flush")
        try:
            async for sse_line in stream_cdn_invalidation(config):
                if isinstance(sse_line, str):
                    yield sse_line
                    continue

                yield format_sse_line(sse_line)

            clear_cdn_queue()
            record_deploy_run(
                kind="cdn",
                label="CDN Flush",
                status="success",
                started_at=started_at,
                completed_at=_now_iso(),
                duration_seconds=time.perf_counter() - started_perf,
                pages_built=0,
                uploaded=0,
                deleted=0,
                cdn_paths=1,
                lambda_version=None,
            )
            yield format_sse({
                "stage": "done",
                "source": "system",
                "line": "CDN invalidation complete",
                "timestamp": _now_iso(),
            })
        except subprocess.CalledProcessError:
            restore_cdn_queue_to_queued()
            record_deploy_run(
                kind="cdn",
                label="CDN Flush",
                status="failed",
                started_at=started_at,
                completed_at=_now_iso(),
                duration_seconds=time.perf_counter() - started_perf,
                pages_built=0,
                uploaded=0,
                deleted=0,
                cdn_paths=1,
                lambda_version=None,
            )
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/cdn/publish/live")
async def cdn_publish_live(request: CdnPublishRequest):
    config = _get_config()

    if not config.cloudfront_distribution_id:
        raise HTTPException(
            status_code=400,
            detail="No CloudFront distribution ID configured (set DEPLOY_CLOUDFRONT_ID)",
        )

    invalidate_paths = _normalize_requested_paths(request.paths)
    if len(invalidate_paths) == 0:
        raise HTTPException(status_code=400, detail="At least one CDN publish path is required")

    async def event_stream():
        import time
        started_at = _now_iso()
        started_perf = time.perf_counter()
        path_count = len(invalidate_paths)
        mark_cdn_queue_running("CDN Publish")
        try:
            async for sse_line in stream_cdn_invalidation(
                config,
                invalidation_mode="smart",
                invalidate_paths=invalidate_paths,
            ):
                if isinstance(sse_line, str):
                    yield sse_line
                    continue

                yield format_sse_line(sse_line)

            clear_cdn_queue()
            record_deploy_run(
                kind="cdn",
                label="CDN Publish",
                status="success",
                started_at=started_at,
                completed_at=_now_iso(),
                duration_seconds=time.perf_counter() - started_perf,
                pages_built=0,
                uploaded=0,
                deleted=0,
                cdn_paths=path_count,
                lambda_version=None,
            )
            yield format_sse({
                "stage": "done",
                "source": "system",
                "line": "CDN publish complete",
                "timestamp": _now_iso(),
            })
        except subprocess.CalledProcessError:
            restore_cdn_queue_to_queued()
            record_deploy_run(
                kind="cdn",
                label="CDN Publish",
                status="failed",
                started_at=started_at,
                completed_at=_now_iso(),
                duration_seconds=time.perf_counter() - started_perf,
                pages_built=0,
                uploaded=0,
                deleted=0,
                cdn_paths=path_count,
                lambda_version=None,
            )
            return

    return StreamingResponse(event_stream(), media_type="text/event-stream")
