from __future__ import annotations

import json
import logging
import secrets
import subprocess
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

logger = logging.getLogger("deploy-dashboard.cdn-queue")

_TOOL_ROOT = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _TOOL_ROOT.parent.parent
_QUEUE_FILE = _TOOL_ROOT / "app" / "runtime" / "cdn_queue.json"
_PLANNER_MODULE = (_TOOL_ROOT / "ui" / "publish-cdn-plan.ts").as_uri()
_PLANNER_TIMEOUT_SECONDS = 30
_queue_lock = Lock()
_queue_entries: list["CdnQueueEntry"] = []
_active_action = ""


@dataclass(frozen=True)
class CdnQueueEntry:
    id: str
    label: str
    mode: str
    paths: list[str]
    reason: str
    source_profile: str
    status: str
    queued_at: str
    started_at: str

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "mode": self.mode,
            "paths": list(self.paths),
            "reason": self.reason,
            "sourceProfile": self.source_profile,
            "status": self.status,
            "queuedAt": self.queued_at,
            "startedAt": self.started_at,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_mode(mode: str | None) -> str:
    normalized = f"{mode or ''}".strip().upper()
    if normalized == "FULL":
        return "FULL"
    if normalized == "SMART":
        return "SMART"
    return ""


def _normalize_status(status: str | None) -> str:
    normalized = f"{status or ''}".strip().upper()
    return "RUNNING" if normalized == "RUNNING" else "QUEUED"


def _normalize_paths(paths: list[str] | None) -> list[str]:
    normalized_paths: list[str] = []
    seen_paths: set[str] = set()

    for raw_path in paths or []:
        path_value = f"{raw_path or ''}".strip()
        if not path_value:
            continue

        normalized_path = path_value if path_value.startswith("/") else f"/{path_value}"
        if normalized_path in seen_paths:
            continue

        seen_paths.add(normalized_path)
        normalized_paths.append(normalized_path)

    return normalized_paths


def _entry_from_payload(payload: dict[str, Any]) -> CdnQueueEntry:
    return CdnQueueEntry(
        id=f"{payload.get('id') or secrets.token_hex(4)}",
        label=f"{payload.get('label') or ''}",
        mode=_normalize_mode(payload.get("mode")),
        paths=_normalize_paths(payload.get("paths")),
        reason=f"{payload.get('reason') or ''}",
        source_profile=f"{payload.get('source_profile') or payload.get('sourceProfile') or ''}",
        status=_normalize_status(payload.get("status")),
        queued_at=f"{payload.get('queued_at') or payload.get('queuedAt') or ''}",
        started_at=f"{payload.get('started_at') or payload.get('startedAt') or ''}",
    )


def _build_queue_log_line(entry: CdnQueueEntry) -> str:
    verb = "running" if entry.status == "RUNNING" else "queued"
    return f"[queue] {entry.label} {verb} {len(entry.paths)} CDN path(s)"


def _build_queue_mode(entries: list[CdnQueueEntry]) -> str:
    if any(entry.mode == "FULL" for entry in entries):
        return "FULL"

    for entry in entries:
        if entry.mode:
            return entry.mode

    return ""


def _build_state_locked() -> dict[str, Any]:
    merged_paths: list[str] = []
    seen_paths: set[str] = set()
    for entry in _queue_entries:
        for path in entry.paths:
            if path in seen_paths:
                continue
            seen_paths.add(path)
            merged_paths.append(path)

    status = "CLEAR"
    if _queue_entries:
        status = "RUNNING" if any(entry.status == "RUNNING" for entry in _queue_entries) else "QUEUED"

    return {
        "activeAction": _active_action,
        "entries": [entry.to_api_dict() for entry in _queue_entries],
        "logLines": [_build_queue_log_line(entry) for entry in _queue_entries],
        "mode": _build_queue_mode(_queue_entries),
        "paths": merged_paths,
        "status": status,
    }


def _save_to_disk_locked() -> None:
    try:
        payload = {
            "active_action": _active_action,
            "entries": [asdict(entry) for entry in _queue_entries],
        }
        _QUEUE_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception:
        logger.exception("Failed to persist CDN queue to %s", _QUEUE_FILE)


def reload_cdn_queue_from_disk() -> None:
    with _queue_lock:
        _queue_entries.clear()
        global _active_action
        _active_action = ""

        if not _QUEUE_FILE.exists():
            return

        try:
            payload = json.loads(_QUEUE_FILE.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                entries = payload.get("entries", [])
                _active_action = f"{payload.get('active_action') or payload.get('activeAction') or ''}"
            elif isinstance(payload, list):
                entries = payload
            else:
                entries = []

            for raw_entry in entries:
                if not isinstance(raw_entry, dict):
                    continue
                entry = _entry_from_payload(raw_entry)
                if not entry.paths:
                    continue
                _queue_entries.append(entry)
        except Exception:
            logger.exception("Failed to load CDN queue from %s", _QUEUE_FILE)


reload_cdn_queue_from_disk()


def clear_cdn_queue() -> None:
    with _queue_lock:
        _queue_entries.clear()
        global _active_action
        _active_action = ""
        _save_to_disk_locked()


def append_cdn_queue_plan(*, label: str, plan: dict[str, Any]) -> dict[str, Any] | None:
    entry_paths = _normalize_paths(plan.get("paths"))
    if not entry_paths:
        return None

    entry = CdnQueueEntry(
        id=secrets.token_hex(4),
        label=label,
        mode=_normalize_mode(plan.get("mode")),
        paths=entry_paths,
        reason=f"{plan.get('reason') or ''}",
        source_profile=f"{plan.get('sourceProfile') or plan.get('source_profile') or ''}",
        status="QUEUED",
        queued_at=_now_iso(),
        started_at="",
    )

    with _queue_lock:
        _queue_entries.append(entry)
        _save_to_disk_locked()

    return entry.to_api_dict()


def mark_cdn_queue_running(action_label: str) -> None:
    with _queue_lock:
        if not _queue_entries:
            return

        now = _now_iso()
        global _active_action
        _active_action = action_label
        _queue_entries[:] = [
            replace(
                entry,
                status="RUNNING",
                started_at=entry.started_at or now,
            )
            for entry in _queue_entries
        ]
        _save_to_disk_locked()


def restore_cdn_queue_to_queued() -> None:
    with _queue_lock:
        if not _queue_entries:
            return

        global _active_action
        _active_action = ""
        _queue_entries[:] = [
            replace(entry, status="QUEUED")
            for entry in _queue_entries
        ]
        _save_to_disk_locked()


def get_cdn_queue_state() -> dict[str, Any]:
    with _queue_lock:
        return _build_state_locked()


def build_publish_cdn_queue_plan(*, pending_files: list[Any], source_profile: str) -> dict[str, Any]:
    if source_profile not in {
        "s3-data-publish",
        "s3-data-rebuild",
        "s3-image-publish",
        "s3-image-rebuild",
    }:
        return {
            "mode": "",
            "paths": [],
            "reason": "",
            "sourceProfile": source_profile,
        }

    payload = {
        "pendingFiles": [
            {
                "category": getattr(file, "category", None) if not isinstance(file, dict) else file.get("category"),
                "file_type": getattr(file, "file_type", None) if not isinstance(file, dict) else file.get("file_type"),
                "path": getattr(file, "path", None) if not isinstance(file, dict) else file.get("path"),
            }
            for file in pending_files
        ],
        "profile": source_profile,
    }

    script = "\n".join([
        f"import {{ buildInstantPublishCdnPlan }} from {json.dumps(_PLANNER_MODULE)};",
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        "  const payload = JSON.parse(input || '{}');",
        "  const plan = buildInstantPublishCdnPlan(payload);",
        "  console.log(JSON.stringify(plan));",
        "});",
    ])

    try:
        result = subprocess.run(
            ["node", "--import", "tsx", "--eval", script],
            capture_output=True,
            cwd=str(_REPO_ROOT),
            input=json.dumps(payload),
            shell=False,
            text=True,
            timeout=_PLANNER_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.exception("Failed to run CDN queue planner for %s", source_profile)
        return {
            "mode": "",
            "paths": [],
            "reason": "",
            "sourceProfile": source_profile,
        }

    if result.returncode != 0:
        logger.error(
            "CDN queue planner failed for %s: %s",
            source_profile,
            result.stderr.strip(),
        )
        return {
            "mode": "",
            "paths": [],
            "reason": "",
            "sourceProfile": source_profile,
        }

    try:
        plan = json.loads(result.stdout.strip() or "{}")
    except json.JSONDecodeError:
        logger.error("CDN queue planner returned invalid JSON for %s", source_profile)
        return {
            "mode": "",
            "paths": [],
            "reason": "",
            "sourceProfile": source_profile,
        }

    return {
        "mode": _normalize_mode(plan.get("mode")),
        "paths": _normalize_paths(plan.get("paths")),
        "reason": f"{plan.get('reason') or ''}",
        "sourceProfile": source_profile,
    }
