from __future__ import annotations

import os
import random
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from config import AppConfig


def _make_config(tmp_path: Path) -> AppConfig:
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    (tmp_path / "src").mkdir(exist_ok=True)
    (tmp_path / "dist" / "client").mkdir(parents=True, exist_ok=True)
    (tmp_path / "public").mkdir(exist_ok=True)
    return AppConfig(
        project_root=tmp_path,
        src_dir=tmp_path / "src",
        dist_dir=tmp_path / "dist",
        dist_client_dir=tmp_path / "dist" / "client",
        public_dir=tmp_path / "public",
        astro_cache_dir=tmp_path / ".astro",
        vite_cache_dir=tmp_path / "node_modules" / ".vite",
        sync_marker_path=tmp_path / ".last_sync_success",
        s3_bucket="test-bucket",
        aws_region="us-east-2",
        cloudfront_distribution_id="TEST123",
        port=8420,
    )


def _seed_sample_project(config: AppConfig) -> tuple[Path, bytes]:
    sample_text_file = config.src_dir / "content" / "news" / "story-000.mdx"
    sample_text = b"---\ntitle: Sample\n---\nBody\n"

    for index in range(120):
        path = config.public_dir / "images" / "products" / f"image-{index:03d}.webp"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(f"image-{index:03d}".encode("utf-8"))

    for index in range(16):
        path = config.src_dir / "content" / "news" / f"story-{index:03d}.mdx"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(sample_text if path == sample_text_file else f"---\ntitle: Story {index}\n---\nPost\n".encode("utf-8"))

    for index in range(14):
        path = config.src_dir / "data" / "products" / f"data-{index:03d}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('{"id": %d}' % index, encoding="utf-8")

    for index in range(8):
        path = config.src_dir / "styles" / f"style-{index:03d}.css"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f".sample-{index} {{ color: red; }}", encoding="utf-8")

    for index in range(8):
        path = config.src_dir / "shared" / "scripts" / f"helper-{index:03d}.js"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"export const helper{index} = {index};", encoding="utf-8")

    for index in range(10):
        path = config.src_dir / "features" / "search" / f"search-{index:03d}.ts"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"export const search{index}: number = {index};", encoding="utf-8")

    return sample_text_file, sample_text


def test_fake_change_service_touches_mixed_random_sample_without_mutating_contents(tmp_path):
    from services.fake_changes import apply_fake_changes

    config = _make_config(tmp_path)
    sample_text_file, original_bytes = _seed_sample_project(config)

    result = apply_fake_changes(config, now=2_000.0, rng=random.Random(7))

    bucket_map = {bucket["key"]: bucket for bucket in result["buckets"]}
    assert result["success"] is True
    assert result["totalTouched"] == 142
    assert bucket_map["images"]["touched"] == 100
    assert bucket_map["content"]["touched"] == 12
    assert bucket_map["data"]["touched"] == 10
    assert bucket_map["css"]["touched"] == 6
    assert bucket_map["js"]["touched"] == 6
    assert bucket_map["ts"]["touched"] == 8
    assert sample_text_file.read_bytes() == original_bytes
    for rel_path in result["files"]:
        assert (config.project_root / rel_path).stat().st_mtime == 2_000.0


def test_fake_change_endpoint_returns_bucketed_touch_summary(tmp_path):
    from main import app

    config = _make_config(tmp_path)
    _seed_sample_project(config)

    with patch("main.config", config):
        client = TestClient(app)
        response = client.post("/api/simulate/fake-changes")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["totalTouched"] > 0
    assert isinstance(data["files"], list)
    assert {bucket["key"] for bucket in data["buckets"]} == {"images", "content", "data", "css", "js", "ts"}


def test_fake_change_service_advances_touched_files_beyond_recent_image_marker(tmp_path):
    from services.fake_changes import apply_fake_changes
    from services.watcher import get_image_sync_marker_path, get_pending_changes, touch_image_sync_marker

    config = _make_config(tmp_path)
    _seed_sample_project(config)
    for path in config.project_root.rglob("*"):
        if path.is_file():
            os.utime(path, (4_900.0, 4_900.0))

    touch_image_sync_marker(config)
    image_marker_path = get_image_sync_marker_path(config)
    os.utime(image_marker_path, (5_000.0, 5_000.0))

    with patch("services.fake_changes.time.time", return_value=5_000.0):
        apply_fake_changes(config, rng=random.Random(7))

    status = get_pending_changes(config)

    assert status.has_pending_image_uploads is True
    assert status.pending_image_upload_count > 0
