"""
Phase 2 tests — cache purge logic and endpoint.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import AppConfig


def _make_config(tmp_path: Path) -> AppConfig:
    """Build a test config rooted at tmp_path."""
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


# ── Pure function tests ──────────────────────────────────────────────


def test_purge_both_exist(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    cfg.astro_cache_dir.mkdir(parents=True)
    (cfg.astro_cache_dir / "chunks.mjs").write_text("x")
    cfg.vite_cache_dir.mkdir(parents=True)
    (cfg.vite_cache_dir / "deps.json").write_text("y")

    result = purge_cache(cfg)

    assert result["success"] is True
    assert ".astro" in result["cleared"]
    assert "node_modules/.vite" in result["cleared"]
    assert not cfg.astro_cache_dir.exists()
    assert not cfg.vite_cache_dir.exists()


def test_purge_only_astro(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    cfg.astro_cache_dir.mkdir(parents=True)
    (cfg.astro_cache_dir / "data.json").write_text("z")

    result = purge_cache(cfg)

    assert result["cleared"] == [".astro"]
    assert not cfg.astro_cache_dir.exists()


def test_purge_only_vite(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    cfg.vite_cache_dir.mkdir(parents=True)
    (cfg.vite_cache_dir / "cache.bin").write_text("w")

    result = purge_cache(cfg)

    assert result["cleared"] == ["node_modules/.vite"]
    assert not cfg.vite_cache_dir.exists()


def test_purge_neither_exist(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    result = purge_cache(cfg)

    assert result["success"] is True
    assert result["cleared"] == []
    assert result["resetMarkers"] == []
    assert result["message"] == "Cache already clean"


def test_purge_idempotent(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    cfg.astro_cache_dir.mkdir(parents=True)
    (cfg.astro_cache_dir / "f.txt").write_text("a")

    first = purge_cache(cfg)
    assert first["cleared"] == [".astro"]

    second = purge_cache(cfg)
    assert second["cleared"] == []
    assert second["resetMarkers"] == []
    assert second["message"] == "Cache already clean"


def test_purge_resets_site_build_data_and_image_markers(tmp_path: Path):
    from routers.cache import purge_cache
    from services.watcher import (
        get_build_sync_marker_path,
        get_data_sync_marker_path,
        get_image_sync_marker_path,
        touch_build_sync_marker,
        touch_data_sync_marker,
        touch_image_sync_marker,
        touch_sync_marker,
    )

    cfg = _make_config(tmp_path)

    touch_sync_marker(cfg)
    touch_build_sync_marker(cfg)
    touch_data_sync_marker(cfg)
    touch_image_sync_marker(cfg)

    result = purge_cache(cfg)

    assert result["resetMarkers"] == [
        ".last_sync_success",
        ".last_astro_build_success",
        ".last_data_publish_success",
        ".last_image_publish_success",
    ]
    assert not cfg.sync_marker_path.exists()
    assert not get_build_sync_marker_path(cfg).exists()
    assert not get_data_sync_marker_path(cfg).exists()
    assert not get_image_sync_marker_path(cfg).exists()


def test_purge_keeps_lambda_marker_intact(tmp_path: Path):
    from routers.cache import purge_cache
    from services.watcher import get_lambda_sync_marker_path, touch_lambda_sync_marker

    cfg = _make_config(tmp_path)
    touch_lambda_sync_marker(cfg)

    result = purge_cache(cfg)

    assert result["resetMarkers"] == []
    assert get_lambda_sync_marker_path(cfg).exists()


def test_purge_reports_reset_when_only_markers_changed(tmp_path: Path):
    from routers.cache import purge_cache
    from services.watcher import touch_build_sync_marker, touch_image_sync_marker, touch_sync_marker

    cfg = _make_config(tmp_path)
    touch_sync_marker(cfg)
    touch_build_sync_marker(cfg)
    touch_image_sync_marker(cfg)

    result = purge_cache(cfg)

    assert result["cleared"] == []
    assert result["resetMarkers"] == [
        ".last_sync_success",
        ".last_astro_build_success",
        ".last_image_publish_success",
    ]
    assert result["message"] == "Local cache state reset"


def test_purge_endpoint_returns_200():
    from main import app

    client = TestClient(app)
    response = client.post("/api/cache/purge")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "cleared" in data
    assert "resetMarkers" in data
    assert "message" in data


def test_purge_with_nested_files(tmp_path: Path):
    from routers.cache import purge_cache

    cfg = _make_config(tmp_path)
    nested = cfg.astro_cache_dir / "deep" / "nested" / "dir"
    nested.mkdir(parents=True)
    (nested / "file1.txt").write_text("a")
    (nested / "file2.txt").write_text("b")
    (cfg.astro_cache_dir / "top.txt").write_text("c")

    result = purge_cache(cfg)

    assert ".astro" in result["cleared"]
    assert not cfg.astro_cache_dir.exists()
