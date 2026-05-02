"""
Build endpoints.

POST /api/build/quick -- cached Astro build + S3 sync (SSE stream)
POST /api/build/full  -- cache purge + clean build + S3 sync (SSE stream)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from config import AppConfig, to_command_path

logger = logging.getLogger("deploy-dashboard.build")
from routers.cache import purge_cache
from services.cdn_queue import append_cdn_queue_plan, build_publish_cdn_queue_plan
from services.deploy_history import record_deploy_run
from services.runner import (
    CommandStep,
    SSELine,
    format_sse,
    format_sse_line,
    stream_commands,
)
from services.watcher import (
    get_pending_changes,
    touch_build_sync_marker,
    touch_data_sync_marker,
    touch_image_sync_marker,
    touch_sync_marker,
)

router = APIRouter()

_build_lock = asyncio.Lock()
_SITE_STAGE_MAP = {
    "build": "build",
    "read-stack": "sync",
    "preview-static": "sync",
    "sync-static": "sync",
    "invalidate": "cdn",
}

STATIC_STASH_DIRECTORY_ALIASES = (
    "orginals",
    "orginanls",
    "original",
    "originals",
)

S3_SYNC_EXCLUDES = [
    *[
        flag
        for directory_name in STATIC_STASH_DIRECTORY_ALIASES
        for flag in ("--exclude", f"*/{directory_name}/*")
    ],
    "--exclude", "*Thumbs.db",
    "--exclude", "*Desktop.ini",
    "--exclude", "*.DS_Store",
]


@dataclass(frozen=True)
class SiteStageProgressLine(SSELine):
    kind: str = "site_stage_progress"
    progress: int = 0
    detail: str = ""


@dataclass(frozen=True)
class RouteGraphWarningLine(SSELine):
    kind: str = "route_graph_warning"
    warning_json: str = ""


def _get_config() -> AppConfig:
    from main import config
    return config


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _touch_publish_markers(
    config: AppConfig,
    *marker_touchers: Callable[[AppConfig], None],
) -> None:
    for marker_toucher in marker_touchers:
        marker_toucher(config)


def _touch_full_site_publish_markers(config: AppConfig) -> None:
    _touch_publish_markers(
        config,
        touch_build_sync_marker,
        touch_data_sync_marker,
        touch_image_sync_marker,
        touch_sync_marker,
    )


def _build_s3_sync_args(config: AppConfig, dry_run: bool = False) -> list[str]:
    args = [
        "aws", "s3", "sync",
        str(config.dist_client_dir).replace("\\", "/") + "/",
        f"s3://{config.s3_bucket}/",
        "--delete",
        "--region", config.aws_region,
        *S3_SYNC_EXCLUDES,
    ]
    if dry_run:
        args.append("--dryrun")
    return args


def _build_cdn_invalidation_args(config: AppConfig) -> list[str]:
    return [
        "aws", "cloudfront", "create-invalidation",
        "--distribution-id", config.cloudfront_distribution_id,
        "--paths", "/*",
        "--region", config.aws_region,
    ]


def build_site_deploy_args(config: AppConfig, mode: str) -> list[str]:
    deploy_script = to_command_path(config.deploy_script_path, cwd=config.project_root)

    if mode == "quick":
        return [
            "node",
            deploy_script,
            "--skip-stack",
            "--static-scope",
            "site",
            "--sync-mode",
            "quick",
            "--invalidation-mode",
            "smart",
        ]

    if mode == "full":
        return [
            "node",
            deploy_script,
            "--skip-stack",
            "--static-scope",
            "site",
            "--sync-mode",
            "full",
            "--invalidation-mode",
            "full",
        ]

    if mode == "quick-sync-only":
        return [
            "node",
            deploy_script,
            "--skip-build",
            "--skip-stack",
            "--static-scope",
            "site",
            "--sync-mode",
            "quick",
            "--invalidation-mode",
            "smart",
        ]

    if mode == "astro-publish":
        return [
            "node",
            deploy_script,
            "--skip-stack",
            "--skip-static",
            "--skip-invalidate",
            "--sync-mode",
            "quick",
        ]

    if mode == "astro-rebuild":
        return [
            "node",
            deploy_script,
            "--skip-stack",
            "--skip-static",
            "--skip-invalidate",
        ]

    if mode == "s3-data-rebuild":
        return [
            "node",
            deploy_script,
            "--skip-build",
            "--skip-stack",
            "--skip-invalidate",
            "--static-scope",
            "data",
            "--sync-mode",
            "full",
        ]

    if mode == "s3-data-publish":
        return [
            "node",
            deploy_script,
            "--skip-build",
            "--skip-stack",
            "--skip-invalidate",
            "--static-scope",
            "data",
            "--sync-mode",
            "quick",
        ]

    if mode == "s3-image-rebuild":
        return [
            "node",
            deploy_script,
            "--skip-build",
            "--skip-stack",
            "--skip-invalidate",
            "--static-scope",
            "images",
            "--sync-mode",
            "full",
        ]

    if mode == "s3-image-publish":
        return [
            "node",
            deploy_script,
            "--skip-build",
            "--skip-stack",
            "--skip-invalidate",
            "--static-scope",
            "images",
            "--sync-mode",
            "quick",
        ]

    raise ValueError(f"Unsupported site deploy mode: {mode}")


def _count_cdn_paths(line: str) -> int:
    prefix = "[cdn] paths: "
    if not line.startswith(prefix):
        return 0

    parts = [part.strip() for part in line[len(prefix):].split(",") if part.strip()]
    if parts == ["none"]:
        return 0
    return len(parts)


def collect_page_inventory(config: AppConfig) -> list[dict]:
    dist_dir = Path(config.dist_client_dir)
    if not dist_dir.exists():
        return []

    rows = []
    for html_file in sorted(dist_dir.rglob("index.html")):
        relative_path = html_file.relative_to(dist_dir).as_posix()
        route_path = f"/{relative_path}"
        parts = [part for part in relative_path.split("/") if part]
        category = parts[0] if parts else "root"
        rows.append(
            {
                "id": route_path,
                "path": route_path,
                "cat": category,
                "status": "queued",
                "pct": 0,
                "elapsed": "--",
                "changed": False,
            }
        )
    return rows


def _site_operation_emits_page_inventory(mode: str) -> bool:
    return mode in {"full", "astro-rebuild"}


def _is_split_s3_publish_mode(mode: str) -> bool:
    return mode in {
        "s3-data-publish",
        "s3-data-rebuild",
        "s3-image-publish",
        "s3-image-rebuild",
    }


def _has_pending_build_work(watcher_status) -> bool:
    if watcher_status.build_files is None:
        return watcher_status.pending
    return watcher_status.build_pending


def _cached_publish_skip_done_line(
    config: AppConfig,
    mode: str,
    watcher_status=None,
) -> str | None:
    if mode not in {"quick", "astro-publish", "s3-data-publish", "s3-image-publish"}:
        return None

    watcher_status = watcher_status or get_pending_changes(config)

    if mode == "quick":
        if _has_pending_build_work(watcher_status) or watcher_status.has_pending_uploads:
            return None
        return "No pending build or upload changes; quick publish skipped"

    if _has_pending_build_work(watcher_status):
        return None

    if mode == "s3-data-publish":
        if watcher_status.has_pending_data_uploads:
            return None
        return "No pending data uploads; S3 data publish skipped"

    if mode == "s3-image-publish":
        if watcher_status.has_pending_image_uploads:
            return None
        return "No pending image uploads; S3 image publish skipped"

    return "No pending build changes; Astro publish skipped"


def _resolve_quick_publish_mode(watcher_status) -> str:
    if _has_pending_build_work(watcher_status):
        return "quick"
    return "quick-sync-only"


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

    if payload.get("kind") == "site_stage_progress":
        raw_stage = payload.get("stage", "")
        stage = _SITE_STAGE_MAP.get(raw_stage, raw_stage)
        if stage not in {"build", "sync", "cdn"}:
            return None
        return {
            "detail": payload.get("detail", ""),
            "kind": "site_stage_progress",
            "progress": payload.get("progress", 0),
            "stage": stage,
        }

    if payload.get("kind") == "route_graph_warning":
        return {
            "kind": "route_graph_warning",
            "status": payload.get("status", "warning"),
            "mode": payload.get("mode", ""),
            "issueCount": payload.get("issueCount", 0),
            "logFile": payload.get("logFile", ""),
            "summary": payload.get("summary", {}),
            "logText": payload.get("logText", ""),
        }

    stage = _SITE_STAGE_MAP.get(payload.get("stage", ""))
    if stage is None:
        return None

    return {
        "label": payload.get("label", stage),
        "stage": stage,
        "status": payload.get("status", ""),
    }


async def stream_site_build(config: AppConfig, mode: str):
    args = build_site_deploy_args(config, mode)
    env = os.environ.copy()
    env["EG_TSX_EVENT_STREAM"] = "1"

    logger.info("Site build requested: %s", " ".join(args))

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

    active_stage = (
        "sync"
        if mode in {
            "s3-data-rebuild",
            "s3-image-rebuild",
            "s3-data-publish",
            "s3-image-publish",
        }
        else "build"
    )
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

        deploy_event = _parse_deploy_event(text)
        if deploy_event is not None:
            if deploy_event.get("kind") == "site_stage_progress":
                yield SiteStageProgressLine(
                    stage=deploy_event["stage"],
                    source="system",
                    line=deploy_event["detail"],
                    timestamp=_now_iso(),
                    progress=deploy_event["progress"],
                    detail=deploy_event["detail"],
                )
                continue

            if deploy_event.get("kind") == "route_graph_warning":
                yield RouteGraphWarningLine(
                    stage=active_stage,
                    source="system",
                    line=f"Route graph warning: {deploy_event.get('issueCount', 0)} issues",
                    timestamp=_now_iso(),
                    warning_json=json.dumps(deploy_event),
                )
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


async def _stream_split_site_operation_events(
    config: AppConfig,
    *,
    mode: str,
    label: str,
    done_line: str,
    success_marker_touchers: tuple[Callable[[AppConfig], None], ...] = (),
):
    started_at = _now_iso()
    started_perf = time.perf_counter()
    uploaded_count = 0
    deleted_count = 0
    cdn_path_count = 0
    watcher_status = get_pending_changes(config)
    skip_done_line = _cached_publish_skip_done_line(config, mode, watcher_status)
    if skip_done_line is not None:
        yield format_sse({
            "stage": "done",
            "source": "system",
            "line": skip_done_line,
            "timestamp": _now_iso(),
        })
        return

    queued_cdn_plan = build_publish_cdn_queue_plan(
        pending_files=watcher_status.files,
        source_profile=mode,
    ) if _is_split_s3_publish_mode(mode) else {
        "mode": "",
        "paths": [],
        "reason": "",
        "sourceProfile": mode,
    }

    initial_page_inventory = collect_page_inventory(config)

    try:
        if _site_operation_emits_page_inventory(mode):
            yield format_sse({
                "kind": "page_inventory",
                "stage": "build",
                "source": "system",
                "line": "Page inventory loaded",
                "timestamp": _now_iso(),
                "rows": initial_page_inventory,
            })

        async for sse_line in stream_site_build(config, mode):
            if isinstance(sse_line, RouteGraphWarningLine):
                yield format_sse(json.loads(sse_line.warning_json))
                continue
            if sse_line.stage == "sync" and sse_line.line.startswith("upload:"):
                uploaded_count += 1
            if sse_line.stage == "sync" and sse_line.line.startswith("delete:"):
                deleted_count += 1
            if sse_line.stage == "cdn":
                cdn_path_count = max(cdn_path_count, _count_cdn_paths(sse_line.line))
            yield format_sse_line(sse_line)

        _touch_publish_markers(config, *success_marker_touchers)

        if _is_split_s3_publish_mode(mode):
            append_cdn_queue_plan(
                label=label,
                plan=queued_cdn_plan,
            )

        record_deploy_run(
            kind="site",
            label=label,
            status="success",
            started_at=started_at,
            completed_at=_now_iso(),
            duration_seconds=time.perf_counter() - started_perf,
            pages_built=len(collect_page_inventory(config)),
            uploaded=uploaded_count,
            deleted=deleted_count,
            cdn_paths=cdn_path_count,
            lambda_version=None,
        )

        yield format_sse({
            "stage": "done",
            "source": "system",
            "line": done_line,
            "timestamp": _now_iso(),
        })

    except subprocess.CalledProcessError:
        record_deploy_run(
            kind="site",
            label=label,
            status="failed",
            started_at=started_at,
            completed_at=_now_iso(),
            duration_seconds=time.perf_counter() - started_perf,
            pages_built=len(initial_page_inventory),
            uploaded=uploaded_count,
            deleted=deleted_count,
            cdn_paths=cdn_path_count,
            lambda_version=None,
        )
        return


def build_quick_steps(
    config: AppConfig, dry_run: bool = False
) -> list[CommandStep]:
    steps = [
        CommandStep(
            label="Astro Build",
            stage="build",
            args=["npm", "run", "build"],
            cwd=config.project_root,
        ),
        CommandStep(
            label="S3 Sync",
            stage="sync",
            args=_build_s3_sync_args(config, dry_run=dry_run),
            cwd=config.project_root,
        ),
    ]
    if not dry_run and config.cloudfront_distribution_id:
        steps.append(CommandStep(
            label="CDN Invalidation",
            stage="cdn",
            args=_build_cdn_invalidation_args(config),
            cwd=config.project_root,
        ))
    return steps


def build_quick_sync_only_steps(
    config: AppConfig, dry_run: bool = False
) -> list[CommandStep]:
    steps = [
        CommandStep(
            label="S3 Sync",
            stage="sync",
            args=_build_s3_sync_args(config, dry_run=dry_run),
            cwd=config.project_root,
        ),
    ]
    if not dry_run and config.cloudfront_distribution_id:
        steps.append(CommandStep(
            label="CDN Invalidation",
            stage="cdn",
            args=_build_cdn_invalidation_args(config),
            cwd=config.project_root,
        ))
    return steps


def build_full_steps(
    config: AppConfig, dry_run: bool = False
) -> list[CommandStep]:
    steps = [
        CommandStep(
            label="Astro Build (Clean)",
            stage="build",
            args=["npm", "run", "build"],
            cwd=config.project_root,
        ),
        CommandStep(
            label="S3 Sync (Mirror)",
            stage="sync",
            args=_build_s3_sync_args(config, dry_run=dry_run),
            cwd=config.project_root,
        ),
    ]
    if not dry_run and config.cloudfront_distribution_id:
        steps.append(CommandStep(
            label="CDN Invalidation (/*)",
            stage="cdn",
            args=_build_cdn_invalidation_args(config),
            cwd=config.project_root,
        ))
    return steps


@router.post("/build/quick")
async def api_build_quick(dry_run: bool = Query(False)):
    if _build_lock.locked():
        raise HTTPException(409, "A build is already running")

    logger.info("Quick build requested (dry_run=%s)", dry_run)
    config = _get_config()

    async def event_stream():
        async with _build_lock:
            started_at = _now_iso()
            started_perf = time.perf_counter()
            uploaded_count = 0
            deleted_count = 0
            cdn_path_count = 0
            watcher_status = get_pending_changes(config)
            skip_done_line = _cached_publish_skip_done_line(
                config,
                "quick",
                watcher_status,
            )
            if skip_done_line is not None:
                yield format_sse({
                    "stage": "done",
                    "source": "system",
                    "line": skip_done_line,
                    "timestamp": _now_iso(),
                })
                return

            quick_mode = _resolve_quick_publish_mode(watcher_status)
            initial_page_inventory = collect_page_inventory(config)
            try:
                if _site_operation_emits_page_inventory("quick"):
                    yield format_sse({
                        "kind": "page_inventory",
                        "stage": "build",
                        "source": "system",
                        "line": "Page inventory loaded",
                        "timestamp": _now_iso(),
                        "rows": initial_page_inventory,
                    })

                if dry_run:
                    steps = (
                        build_quick_steps(config, dry_run=True)
                        if quick_mode == "quick"
                        else build_quick_sync_only_steps(config, dry_run=True)
                    )
                    async for sse_line in stream_commands(steps):
                        if sse_line.stage == "sync" and sse_line.line.startswith("upload:"):
                            uploaded_count += 1
                        if sse_line.stage == "sync" and sse_line.line.startswith("delete:"):
                            deleted_count += 1
                        if sse_line.stage == "cdn":
                            cdn_path_count = max(cdn_path_count, _count_cdn_paths(sse_line.line))
                        yield format_sse_line(sse_line)
                else:
                    async for sse_line in stream_site_build(config, quick_mode):
                        if isinstance(sse_line, RouteGraphWarningLine):
                            yield format_sse(json.loads(sse_line.warning_json))
                            continue
                        if sse_line.stage == "sync" and sse_line.line.startswith("upload:"):
                            uploaded_count += 1
                        if sse_line.stage == "sync" and sse_line.line.startswith("delete:"):
                            deleted_count += 1
                        if sse_line.stage == "cdn":
                            cdn_path_count = max(cdn_path_count, _count_cdn_paths(sse_line.line))
                        yield format_sse_line(sse_line)

                if not dry_run:
                    _touch_full_site_publish_markers(config)
                    record_deploy_run(
                        kind="site",
                        label="Quick",
                        status="success",
                        started_at=started_at,
                        completed_at=_now_iso(),
                        duration_seconds=time.perf_counter() - started_perf,
                        pages_built=len(collect_page_inventory(config)),
                        uploaded=uploaded_count,
                        deleted=deleted_count,
                        cdn_paths=cdn_path_count,
                        lambda_version=None,
                    )

                yield format_sse({
                    "stage": "done",
                    "source": "system",
                    "line": "Quick build complete",
                    "timestamp": _now_iso(),
                })

            except subprocess.CalledProcessError:
                if not dry_run:
                    record_deploy_run(
                        kind="site",
                        label="Quick",
                        status="failed",
                        started_at=started_at,
                        completed_at=_now_iso(),
                        duration_seconds=time.perf_counter() - started_perf,
                        pages_built=len(initial_page_inventory),
                        uploaded=uploaded_count,
                        deleted=deleted_count,
                        cdn_paths=cdn_path_count,
                        lambda_version=None,
                    )
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/build/full")
async def api_build_full(dry_run: bool = Query(False)):
    if _build_lock.locked():
        raise HTTPException(409, "A build is already running")

    logger.info("Full build requested (dry_run=%s)", dry_run)
    config = _get_config()

    async def event_stream():
        async with _build_lock:
            started_at = _now_iso()
            started_perf = time.perf_counter()
            uploaded_count = 0
            deleted_count = 0
            cdn_path_count = 0
            result = purge_cache(config)
            cleared_str = ", ".join(result["cleared"]) or "already clean"
            yield format_sse({
                "stage": "cache-purge",
                "source": "system",
                "line": f"Cache purged: {cleared_str}",
                "timestamp": _now_iso(),
            })

            initial_page_inventory = collect_page_inventory(config)
            try:
                if _site_operation_emits_page_inventory("full"):
                    yield format_sse({
                        "kind": "page_inventory",
                        "stage": "build",
                        "source": "system",
                        "line": "Page inventory loaded",
                        "timestamp": _now_iso(),
                        "rows": initial_page_inventory,
                    })

                if dry_run:
                    steps = build_full_steps(config, dry_run=True)
                    async for sse_line in stream_commands(steps):
                        if sse_line.stage == "sync" and sse_line.line.startswith("upload:"):
                            uploaded_count += 1
                        if sse_line.stage == "sync" and sse_line.line.startswith("delete:"):
                            deleted_count += 1
                        if sse_line.stage == "cdn":
                            cdn_path_count = max(cdn_path_count, _count_cdn_paths(sse_line.line))
                        yield format_sse_line(sse_line)
                else:
                    async for sse_line in stream_site_build(config, "full"):
                        if isinstance(sse_line, RouteGraphWarningLine):
                            yield format_sse(json.loads(sse_line.warning_json))
                            continue
                        if sse_line.stage == "sync" and sse_line.line.startswith("upload:"):
                            uploaded_count += 1
                        if sse_line.stage == "sync" and sse_line.line.startswith("delete:"):
                            deleted_count += 1
                        if sse_line.stage == "cdn":
                            cdn_path_count = max(cdn_path_count, _count_cdn_paths(sse_line.line))
                        yield format_sse_line(sse_line)

                if not dry_run:
                    _touch_full_site_publish_markers(config)
                    record_deploy_run(
                        kind="site",
                        label="Full",
                        status="success",
                        started_at=started_at,
                        completed_at=_now_iso(),
                        duration_seconds=time.perf_counter() - started_perf,
                        pages_built=len(collect_page_inventory(config)),
                        uploaded=uploaded_count,
                        deleted=deleted_count,
                        cdn_paths=cdn_path_count,
                        lambda_version=None,
                    )

                yield format_sse({
                    "stage": "done",
                    "source": "system",
                    "line": "Full rebuild complete",
                    "timestamp": _now_iso(),
                })

            except subprocess.CalledProcessError:
                if not dry_run:
                    record_deploy_run(
                        kind="site",
                        label="Full",
                        status="failed",
                        started_at=started_at,
                        completed_at=_now_iso(),
                        duration_seconds=time.perf_counter() - started_perf,
                        pages_built=len(initial_page_inventory),
                        uploaded=uploaded_count,
                        deleted=deleted_count,
                        cdn_paths=cdn_path_count,
                        lambda_version=None,
                    )
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _create_split_site_endpoint(
    mode: str,
    label: str,
    done_line: str,
    success_marker_touchers: tuple[Callable[[AppConfig], None], ...] = (),
):
    async def endpoint():
        if _build_lock.locked():
            raise HTTPException(409, "A build is already running")

        logger.info("%s requested", label)
        config = _get_config()

        async def event_stream():
            async with _build_lock:
                async for event in _stream_split_site_operation_events(
                    config,
                    mode=mode,
                    label=label,
                    done_line=done_line,
                    success_marker_touchers=success_marker_touchers,
                ):
                    yield event

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return endpoint


router.add_api_route(
    "/build/astro-publish",
    _create_split_site_endpoint(
        mode="astro-publish",
        label="Astro Publish",
        done_line="Astro publish complete",
        success_marker_touchers=(touch_build_sync_marker,),
    ),
    methods=["POST"],
)

router.add_api_route(
    "/build/astro-rebuild",
    _create_split_site_endpoint(
        mode="astro-rebuild",
        label="Astro Rebuild",
        done_line="Astro rebuild complete",
        success_marker_touchers=(touch_build_sync_marker,),
    ),
    methods=["POST"],
)

router.add_api_route(
    "/build/s3-data-publish",
    _create_split_site_endpoint(
        mode="s3-data-publish",
        label="S3 Data Publish",
        done_line="S3 data publish complete",
        success_marker_touchers=(touch_data_sync_marker,),
    ),
    methods=["POST"],
)

router.add_api_route(
    "/build/s3-data-rebuild",
    _create_split_site_endpoint(
        mode="s3-data-rebuild",
        label="S3 Data Rebuild",
        done_line="S3 data rebuild complete",
        success_marker_touchers=(touch_data_sync_marker,),
    ),
    methods=["POST"],
)

router.add_api_route(
    "/build/s3-image-publish",
    _create_split_site_endpoint(
        mode="s3-image-publish",
        label="S3 Image Publish",
        done_line="S3 image publish complete",
        success_marker_touchers=(touch_image_sync_marker,),
    ),
    methods=["POST"],
)

router.add_api_route(
    "/build/s3-image-rebuild",
    _create_split_site_endpoint(
        mode="s3-image-rebuild",
        label="S3 Image Rebuild",
        done_line="S3 image rebuild complete",
        success_marker_touchers=(touch_image_sync_marker,),
    ),
    methods=["POST"],
)
