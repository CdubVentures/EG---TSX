"""
File watcher service.

Compares mtime of source files against sync markers to determine which
files are still pending build, upload, or Lambda deploy work.

Performance: source files (~800) and image files (~23K) are scanned
independently with separate TTL caches. Source cache is short-lived (2s),
image cache is long-lived (30s) because images change far less frequently.
"""

from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from config import AppConfig
from services.ttl_cache import TtlCache

LAMBDA_SYNC_MARKER_FILENAME = ".last_lambda_deploy_success"
BUILD_SYNC_MARKER_FILENAME = ".last_astro_build_success"
DATA_SYNC_MARKER_FILENAME = ".last_data_publish_success"
IMAGE_SYNC_MARKER_FILENAME = ".last_image_publish_success"
DB_SYNC_MARKER_FILENAME = ".last_db_sync_success"

CATEGORY_PREFIXES = [
    ("src/content/reviews/", "review"),
    ("src/content/guides/", "guide"),
    ("src/content/news/", "news"),
    ("src/content/brands/", "brand"),
    ("src/content/games/", "game"),
    ("src/content/pages/", "page"),
    ("src/content/data-products/", "product"),
    ("src/data/", "data"),
    ("src/pages/api/", "api"),
    ("src/pages/auth/", "auth"),
    ("src/pages/login/", "auth"),
    ("src/pages/logout.ts", "auth"),
    ("src/pages/", "page-template"),
    ("src/features/auth/server/", "auth"),
    ("src/features/search/", "search"),
    ("src/features/vault/", "vault"),
    ("src/core/db.ts", "lambda-core"),
    ("src/core/media.ts", "lambda-core"),
    ("infrastructure/aws/", "lambda-infra"),
    ("lambda-entry.mjs", "lambda-infra"),
    ("astro.config.mjs", "lambda-infra"),
    ("src/features/", "feature"),
    ("src/shared/", "shared"),
    ("public/images/", "image"),
]

LAMBDA_CATEGORIES = frozenset({"api", "auth", "search", "vault", "lambda-core", "lambda-infra"})

# Lambda changes in these categories require an Astro build before deploy.
# Changes in "lambda-infra" only need repackage (no rebuild).
LAMBDA_BUILD_REQUIRED_CATEGORIES = frozenset({"api", "auth", "search", "vault", "lambda-core"})

# DB sync watches content that maps to search DB rows.
DB_SYNC_CATEGORIES = frozenset({"product", "review", "guide", "news", "brand", "game"})


@dataclass
class ChangedFile:
    path: str
    file_type: str
    category: str
    mtime: str


@dataclass
class WatcherStatus:
    pending: bool
    count: int
    last_sync_at: str | None
    files: list[ChangedFile]
    lambda_files: list[ChangedFile]
    has_product_changes: bool
    has_lambda_changes: bool
    lambda_build_required: bool = False
    build_pending: bool = False
    build_count: int = 0
    build_files: list[ChangedFile] | None = None
    last_build_at: str | None = None
    last_data_sync_at: str | None = None
    last_image_sync_at: str | None = None
    has_pending_uploads: bool = False
    pending_upload_count: int = 0
    has_pending_data_uploads: bool = False
    pending_data_upload_count: int = 0
    has_pending_image_uploads: bool = False
    pending_image_upload_count: int = 0
    has_db_sync_changes: bool = False
    db_sync_count: int = 0
    db_sync_files: list[ChangedFile] | None = None
    last_db_sync_at: str | None = None


def categorize_path(rel_path: str) -> str:
    """Map a forward-slash relative path to its content category."""
    for prefix, category in CATEGORY_PREFIXES:
        if rel_path.startswith(prefix):
            return category
    return "other"


def touch_sync_marker(config: AppConfig) -> None:
    """Create or update .last_sync_success with the current timestamp."""
    _touch_marker(config.sync_marker_path)


def get_lambda_sync_marker_path(config: AppConfig) -> Path:
    return config.project_root / LAMBDA_SYNC_MARKER_FILENAME


def get_build_sync_marker_path(config: AppConfig) -> Path:
    return config.project_root / BUILD_SYNC_MARKER_FILENAME


def get_data_sync_marker_path(config: AppConfig) -> Path:
    return config.project_root / DATA_SYNC_MARKER_FILENAME


def get_image_sync_marker_path(config: AppConfig) -> Path:
    return config.project_root / IMAGE_SYNC_MARKER_FILENAME


def get_db_sync_marker_path(config: AppConfig) -> Path:
    return config.project_root / DB_SYNC_MARKER_FILENAME


def get_site_publish_marker_paths(config: AppConfig) -> list[Path]:
    return [
        config.sync_marker_path,
        get_build_sync_marker_path(config),
        get_data_sync_marker_path(config),
        get_image_sync_marker_path(config),
    ]


def touch_lambda_sync_marker(config: AppConfig) -> None:
    _touch_marker(get_lambda_sync_marker_path(config))


def touch_build_sync_marker(config: AppConfig) -> None:
    _touch_marker(get_build_sync_marker_path(config))


def touch_data_sync_marker(config: AppConfig) -> None:
    _touch_marker(get_data_sync_marker_path(config))


def touch_image_sync_marker(config: AppConfig) -> None:
    _touch_marker(get_image_sync_marker_path(config), image_marker=True)


def touch_db_sync_marker(config: AppConfig) -> None:
    _touch_marker(get_db_sync_marker_path(config))


def clear_site_publish_markers(config: AppConfig) -> list[str]:
    cleared_markers: list[str] = []

    for marker_path in get_site_publish_marker_paths(config):
        if not marker_path.is_file():
            continue

        marker_path.unlink()
        cleared_markers.append(marker_path.name)

    if cleared_markers:
        _invalidate_all_caches()

    return cleared_markers


_defer_lock = threading.Lock()
_defer_depth: int = 0
_defer_pending: bool = False
_defer_pending_image: bool = False


@contextmanager
def defer_cache_invalidation():
    """Batch cache invalidation while an operation is active.

    Marker touches inside this context queue invalidation instead of
    firing it immediately. One invalidation fires when the context exits.
    """
    global _defer_depth, _defer_pending, _defer_pending_image
    with _defer_lock:
        _defer_depth += 1

    try:
        yield
    finally:
        with _defer_lock:
            _defer_depth -= 1
            if _defer_depth == 0:
                if _defer_pending:
                    _watcher_cache.invalidate()
                    _source_cache.invalidate()
                    _defer_pending = False
                if _defer_pending_image:
                    _image_cache.invalidate()
                    _defer_pending_image = False


def _invalidate_source_caches() -> None:
    """Invalidate watcher result + source scan caches (not image)."""
    global _defer_pending
    with _defer_lock:
        if _defer_depth > 0:
            _defer_pending = True
            return
    _watcher_cache.invalidate()
    _source_cache.invalidate()


def _invalidate_image_caches() -> None:
    """Invalidate watcher result + image scan caches."""
    global _defer_pending, _defer_pending_image
    with _defer_lock:
        if _defer_depth > 0:
            _defer_pending = True
            _defer_pending_image = True
            return
    _watcher_cache.invalidate()
    _image_cache.invalidate()


def _invalidate_all_caches() -> None:
    """Invalidate all caches (watcher result + source + image)."""
    global _defer_pending, _defer_pending_image
    with _defer_lock:
        if _defer_depth > 0:
            _defer_pending = True
            _defer_pending_image = True
            return
    _watcher_cache.invalidate()
    _source_cache.invalidate()
    _image_cache.invalidate()


def _touch_marker(marker_path: Path, *, image_marker: bool = False) -> None:
    marker_path.parent.mkdir(parents=True, exist_ok=True)
    marker_path.write_text(
        datetime.now(timezone.utc).isoformat(), encoding="utf-8"
    )
    if image_marker:
        _invalidate_image_caches()
    else:
        _invalidate_source_caches()


def _walk_files(directory: Path) -> list[Path]:
    """Recursively list all files under a directory."""
    if not directory.is_dir():
        return []
    results: list[Path] = []
    for root, _dirs, files in os.walk(directory):
        for name in files:
            results.append(Path(root) / name)
    return results


def _read_marker_state(marker_path: Path) -> tuple[float, str | None]:
    if not marker_path.is_file():
        return 0.0, None

    stat = marker_path.stat()
    return (
        stat.st_mtime,
        datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    )


def _scan_dir_candidates(
    scan_dirs: list[Path],
    project_root: Path,
) -> list[tuple[str, float, str]]:
    """Walk directories, stat each file, return (rel_path, mtime, category)."""
    candidates: list[tuple[str, float, str]] = []
    for scan_dir in scan_dirs:
        for file_path in _walk_files(scan_dir):
            try:
                rel = file_path.relative_to(project_root).as_posix()
                mtime = file_path.stat().st_mtime
            except OSError:
                # WHY: Windows 260-char path limit - skip unreachable files.
                continue
            candidates.append((rel, mtime, categorize_path(rel)))
    return candidates


def _collect_source_candidates(config: AppConfig) -> list[tuple[str, float, str]]:
    """Scan source directories (~800 files). Excludes public/images."""
    cached = _source_cache.get()
    if cached is not None:
        return cached

    scan_dirs = [
        config.src_dir / "content",
        config.src_dir / "data",
        config.src_dir / "pages",
        config.src_dir / "features",
        config.src_dir / "shared",
        config.project_root / "infrastructure" / "aws",
    ]

    candidates = _scan_dir_candidates(scan_dirs, config.project_root)

    # Individual root files that affect Lambda deploys
    root_files = [
        config.project_root / "lambda-entry.mjs",
        config.project_root / "astro.config.mjs",
    ]
    for file_path in root_files:
        if file_path.is_file():
            try:
                rel = file_path.relative_to(config.project_root).as_posix()
                mtime = file_path.stat().st_mtime
            except OSError:
                continue
            candidates.append((rel, mtime, categorize_path(rel)))

    _source_cache.set(candidates)
    return candidates


def _collect_image_candidates(config: AppConfig) -> list[tuple[str, float, str]]:
    """Scan public/images (~23K files). Cached with longer TTL."""
    cached = _image_cache.get()
    if cached is not None:
        return cached

    candidates = _scan_dir_candidates(
        [config.public_dir / "images"],
        config.project_root,
    )

    _image_cache.set(candidates)
    return candidates


def _collect_candidates(config: AppConfig) -> list[tuple[str, float, str]]:
    """Merge source + image candidates. Each pool has its own cache."""
    return _collect_source_candidates(config) + _collect_image_candidates(config)


def _build_changed_files(
    candidates: list[tuple[str, float, str]],
    marker_mtime: float,
) -> list[ChangedFile]:
    file_type = "NEW" if marker_mtime == 0.0 else "MODIFIED"
    return [
        ChangedFile(
            path=rel,
            file_type=file_type,
            category=category,
            mtime=datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
        )
        for rel, mtime, category in candidates
    ]


_watcher_cache = TtlCache(ttl_seconds=2.0)
_source_cache = TtlCache(ttl_seconds=2.0)
_image_cache = TtlCache(ttl_seconds=30.0)


def invalidate_watcher_cache() -> None:
    """Force next get_pending_changes() to rescan. Call after marker touches."""
    _invalidate_all_caches()


def get_pending_changes(config: AppConfig) -> WatcherStatus:
    """
    Compare file mtimes against sync markers.

    Results are cached for 2 seconds to avoid redundant 23K-file scans when
    multiple endpoints call this in the same request burst.

    `pending/count/files` preserve the legacy "not live yet" view that uses
    the global site sync marker. The newer build/upload fields split that same
    source set into build-required work and scoped upload-ready work.
    """
    cached = _watcher_cache.get()
    if cached is not None:
        return cached
    last_sync_mtime, last_sync_at = _read_marker_state(config.sync_marker_path)
    last_lambda_sync_mtime, _last_lambda_sync_at = _read_marker_state(
        get_lambda_sync_marker_path(config)
    )
    last_build_sync_mtime, last_build_at = _read_marker_state(
        get_build_sync_marker_path(config)
    )
    last_data_sync_mtime, last_data_sync_at = _read_marker_state(
        get_data_sync_marker_path(config)
    )
    last_image_sync_mtime, last_image_sync_at = _read_marker_state(
        get_image_sync_marker_path(config)
    )
    last_db_sync_mtime, last_db_sync_at = _read_marker_state(
        get_db_sync_marker_path(config)
    )

    all_candidates = _collect_candidates(config)
    site_candidates = [
        candidate for candidate in all_candidates if candidate[1] > last_sync_mtime
    ]
    lambda_candidates = [
        candidate
        for candidate in all_candidates
        if candidate[2] in LAMBDA_CATEGORIES and candidate[1] > last_lambda_sync_mtime
    ]
    build_candidates = [
        candidate
        for candidate in all_candidates
        if candidate[2] != "image" and candidate[1] > last_build_sync_mtime
    ]
    data_upload_candidates = [
        candidate
        for candidate in all_candidates
        if candidate[2] != "image"
        and candidate[1] <= last_build_sync_mtime
        and candidate[1] > last_data_sync_mtime
    ]
    image_upload_candidates = [
        candidate
        for candidate in all_candidates
        if candidate[2] == "image" and candidate[1] > last_image_sync_mtime
    ]
    db_sync_candidates = [
        candidate
        for candidate in all_candidates
        if candidate[2] in DB_SYNC_CATEGORIES and candidate[1] > last_db_sync_mtime
    ]

    site_candidates.sort(key=lambda candidate: candidate[1], reverse=True)
    lambda_candidates.sort(key=lambda candidate: candidate[1], reverse=True)
    build_candidates.sort(key=lambda candidate: candidate[1], reverse=True)
    data_upload_candidates.sort(key=lambda candidate: candidate[1], reverse=True)
    image_upload_candidates.sort(key=lambda candidate: candidate[1], reverse=True)
    db_sync_candidates.sort(key=lambda candidate: candidate[1], reverse=True)

    files = _build_changed_files(site_candidates, last_sync_mtime)
    lambda_files = _build_changed_files(lambda_candidates, last_lambda_sync_mtime)
    build_files = _build_changed_files(build_candidates, last_build_sync_mtime)
    db_sync_files = _build_changed_files(db_sync_candidates, last_db_sync_mtime)

    has_product_changes = any(changed_file.category == "product" for changed_file in files)
    has_lambda_changes = len(lambda_files) > 0
    lambda_build_required = any(
        lf.category in LAMBDA_BUILD_REQUIRED_CATEGORIES for lf in lambda_files
    )
    pending_data_upload_count = len(data_upload_candidates)
    pending_image_upload_count = len(image_upload_candidates)
    pending_upload_count = pending_data_upload_count + pending_image_upload_count

    result = WatcherStatus(
        pending=len(files) > 0,
        count=len(files),
        last_sync_at=last_sync_at,
        files=files,
        lambda_files=lambda_files,
        has_product_changes=has_product_changes,
        has_lambda_changes=has_lambda_changes,
        lambda_build_required=lambda_build_required,
        build_pending=len(build_files) > 0,
        build_count=len(build_files),
        build_files=build_files,
        last_build_at=last_build_at,
        last_data_sync_at=last_data_sync_at,
        last_image_sync_at=last_image_sync_at,
        has_pending_uploads=pending_upload_count > 0,
        pending_upload_count=pending_upload_count,
        has_pending_data_uploads=pending_data_upload_count > 0,
        pending_data_upload_count=pending_data_upload_count,
        has_pending_image_uploads=pending_image_upload_count > 0,
        pending_image_upload_count=pending_image_upload_count,
        has_db_sync_changes=len(db_sync_files) > 0,
        db_sync_count=len(db_sync_files),
        db_sync_files=db_sync_files,
        last_db_sync_at=last_db_sync_at,
    )

    _watcher_cache.set(result)
    return result
