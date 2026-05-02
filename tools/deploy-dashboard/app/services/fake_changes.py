from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass
from pathlib import Path

from config import AppConfig
from services.watcher import (
    get_build_sync_marker_path,
    get_data_sync_marker_path,
    get_image_sync_marker_path,
    get_lambda_sync_marker_path,
)


@dataclass(frozen=True)
class FakeChangeBucket:
    key: str
    label: str
    requested: int
    roots: tuple[str, ...]
    extensions: tuple[str, ...]


FAKE_CHANGE_BUCKETS = (
    FakeChangeBucket(
        key="images",
        label="Images",
        requested=100,
        roots=("public/images",),
        extensions=(".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"),
    ),
    FakeChangeBucket(
        key="content",
        label="Content",
        requested=12,
        roots=(
            "src/content/reviews",
            "src/content/guides",
            "src/content/news",
            "src/content/brands",
            "src/content/games",
            "src/content/pages",
        ),
        extensions=(".md", ".mdx", ".astro"),
    ),
    FakeChangeBucket(
        key="data",
        label="Data",
        requested=10,
        roots=("src/data", "src/content/data-products"),
        extensions=(".json", ".yaml", ".yml", ".csv", ".toml"),
    ),
    FakeChangeBucket(
        key="css",
        label="CSS",
        requested=6,
        roots=("src", "public"),
        extensions=(".css", ".scss"),
    ),
    FakeChangeBucket(
        key="js",
        label="JavaScript",
        requested=6,
        roots=("src",),
        extensions=(".js", ".jsx", ".mjs"),
    ),
    FakeChangeBucket(
        key="ts",
        label="TypeScript",
        requested=8,
        roots=("src",),
        extensions=(".ts", ".tsx"),
    ),
)


def _collect_candidates(config: AppConfig, bucket: FakeChangeBucket) -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()
    for rel_root in bucket.roots:
        root = config.project_root / rel_root
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in bucket.extensions:
                continue
            if path in seen:
                continue
            seen.add(path)
            candidates.append(path)
    return candidates


def _touch_paths(paths: list[Path], *, timestamp: float) -> list[str]:
    touched: list[str] = []
    for path in paths:
        os.utime(path, (timestamp, timestamp))
        touched.append(path.as_posix())
    return touched


def _resolve_touch_time(config: AppConfig, *, now: float | None) -> float:
    if now is not None:
        return now

    marker_paths = [
        config.sync_marker_path,
        get_build_sync_marker_path(config),
        get_data_sync_marker_path(config),
        get_image_sync_marker_path(config),
        get_lambda_sync_marker_path(config),
    ]
    latest_marker_mtime = 0.0
    for marker_path in marker_paths:
        try:
            if marker_path.is_file():
                latest_marker_mtime = max(latest_marker_mtime, marker_path.stat().st_mtime)
        except OSError:
            continue

    return max(time.time(), latest_marker_mtime + 1.0)


def apply_fake_changes(
    config: AppConfig,
    *,
    now: float | None = None,
    rng: random.Random | None = None,
) -> dict:
    touch_time = _resolve_touch_time(config, now=now)
    picker = rng or random.Random()
    touched_files: list[str] = []
    bucket_summaries: list[dict] = []

    for bucket in FAKE_CHANGE_BUCKETS:
        candidates = _collect_candidates(config, bucket)
        sample_size = min(bucket.requested, len(candidates))
        selected = sorted(
            picker.sample(candidates, sample_size),
            key=lambda path: path.as_posix(),
        ) if sample_size else []
        touched_bucket_files = _touch_paths(selected, timestamp=touch_time)
        touched_files.extend(
            Path(path).relative_to(config.project_root).as_posix()
            for path in touched_bucket_files
        )
        bucket_summaries.append(
            {
                "key": bucket.key,
                "label": bucket.label,
                "requested": bucket.requested,
                "available": len(candidates),
                "touched": len(touched_bucket_files),
            }
        )

    return {
        "success": True,
        "message": "Applied fake random file changes without mutating contents.",
        "totalTouched": len(touched_files),
        "buckets": bucket_summaries,
        "files": touched_files,
    }
