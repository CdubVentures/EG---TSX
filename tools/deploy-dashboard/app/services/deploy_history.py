from __future__ import annotations

import json
import logging
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
import secrets

logger = logging.getLogger("deploy-dashboard.history")

_HISTORY_LIMIT = 25
_HISTORY_FILE = Path(__file__).resolve().parent.parent / "runtime" / "deploy_history.json"
_history_lock = Lock()
_history: deque["DeployRun"] = deque(maxlen=_HISTORY_LIMIT)


@dataclass(frozen=True)
class DeployRun:
    id: str
    kind: str
    label: str
    status: str
    started_at: str
    completed_at: str
    duration_seconds: float
    pages_built: int
    uploaded: int
    deleted: int
    cdn_paths: int
    lambda_version: int | None

    def to_api_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "label": self.label,
            "status": self.status,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "durationSeconds": self.duration_seconds,
            "pagesBuilt": self.pages_built,
            "uploaded": self.uploaded,
            "deleted": self.deleted,
            "cdnPaths": self.cdn_paths,
            "lambdaVersion": self.lambda_version,
        }


def _save_to_disk() -> None:
    """Persist current history to JSON. Called under lock."""
    try:
        records = [asdict(run) for run in _history]
        _HISTORY_FILE.write_text(json.dumps(records, indent=2), encoding="utf-8")
    except Exception:
        logger.exception("Failed to save deploy history to %s", _HISTORY_FILE)


def _load_from_disk() -> None:
    """Load history from JSON on startup. Called once at module init."""
    if not _HISTORY_FILE.exists():
        return

    try:
        raw = json.loads(_HISTORY_FILE.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return

        for entry in raw:
            if not isinstance(entry, dict):
                continue
            _history.append(DeployRun(
                id=str(entry.get("id", secrets.token_hex(3))),
                kind=str(entry.get("kind", "")),
                label=str(entry.get("label", "")),
                status=str(entry.get("status", "")),
                started_at=str(entry.get("started_at", "")),
                completed_at=str(entry.get("completed_at", "")),
                duration_seconds=round(float(entry.get("duration_seconds", 0)), 1),
                pages_built=int(entry.get("pages_built", 0)),
                uploaded=int(entry.get("uploaded", 0)),
                deleted=int(entry.get("deleted", 0)),
                cdn_paths=int(entry.get("cdn_paths", 0)),
                lambda_version=entry.get("lambda_version"),
            ))
        logger.info("Loaded %d deploy history entries from disk", len(_history))
    except Exception:
        logger.exception("Failed to load deploy history from %s", _HISTORY_FILE)


# Load persisted history on module import
_load_from_disk()


def clear_deploy_history() -> None:
    with _history_lock:
        _history.clear()
        _save_to_disk()


def record_deploy_run(
    *,
    kind: str,
    label: str,
    status: str,
    started_at: str,
    completed_at: str,
    duration_seconds: float,
    pages_built: int,
    uploaded: int,
    deleted: int,
    cdn_paths: int,
    lambda_version: int | None,
) -> dict:
    run = DeployRun(
        id=secrets.token_hex(3),
        kind=kind,
        label=label,
        status=status,
        started_at=started_at,
        completed_at=completed_at,
        duration_seconds=round(float(duration_seconds), 1),
        pages_built=int(pages_built),
        uploaded=int(uploaded),
        deleted=int(deleted),
        cdn_paths=int(cdn_paths),
        lambda_version=lambda_version,
    )
    with _history_lock:
        _history.appendleft(run)
        _save_to_disk()
    return run.to_api_dict()


def get_recent_runs() -> list[dict]:
    with _history_lock:
        return [run.to_api_dict() for run in _history]
