"""
Phase 7 integration tests — cross-endpoint flows with mocked subprocess.
"""

import asyncio
import json
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from config import AppConfig
from services.runner import SSELine
from services.watcher import ChangedFile, WatcherStatus


def _make_config(tmp_path: Path) -> AppConfig:
    # Create package.json so startup validation passes
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    (tmp_path / "src" / "content").mkdir(parents=True)
    (tmp_path / "src" / "data").mkdir(parents=True)
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


def _parse_sse_events(response_text: str) -> list[dict]:
    events = []
    for chunk in response_text.split("\n\n"):
        chunk = chunk.strip()
        if chunk.startswith("data: "):
            events.append(json.loads(chunk[6:]))
    return events


async def _mock_stream_success(steps, on_complete=None):
    for step in steps:
        yield SSELine(
            stage=step.stage,
            source="stdout",
            line=f"mock {step.label}",
            timestamp="2026-03-07T15:00:00Z",
        )
    if on_complete:
        on_complete()


async def _mock_stream_failure(steps, on_complete=None):
    step = steps[0]
    yield SSELine(
        stage=step.stage,
        source="system",
        line="FAILED with exit code 1",
        timestamp="2026-03-07T15:00:00Z",
    )
    raise subprocess.CalledProcessError(1, step.args)


async def _mock_site_build_stream(_config, _mode):
    for stage, line in [
        ("build", "Starting: Running Astro Build"),
        ("sync", "Starting: Syncing Changed Site Files"),
        ("cdn", "Starting: Invalidating CloudFront (Smart)"),
    ]:
        yield SSELine(
            stage=stage,
            source="system",
            line=line,
            timestamp="2026-03-07T15:00:00Z",
        )


async def _mock_site_build_stream_failure(_config, _mode):
    yield SSELine(
        stage="build",
        source="system",
        line="FAILED with exit code 1",
        timestamp="2026-03-07T15:00:00Z",
    )
    raise subprocess.CalledProcessError(1, ["node", "scripts/deploy-aws.mjs"])


# ── Integration flows ─────────────────────────────────────────────────


def test_health_to_status_to_purge_flow(tmp_path):
    """Sequential: health check → status → purge cache."""
    from main import app

    cfg = _make_config(tmp_path)
    # Create cache dirs to purge
    cfg.astro_cache_dir.mkdir(parents=True)
    (cfg.astro_cache_dir / "chunks").mkdir()

    with patch("routers.cache._get_config", create=True, side_effect=lambda: None), \
         patch("main.config", cfg), \
         patch("routers.status.get_pending_changes") as mock_status:

        mock_status.return_value = WatcherStatus(
            pending=False, count=0, last_sync_at=None, files=[],
            lambda_files=[],
            has_product_changes=False,
            has_lambda_changes=False,
        )

        client = TestClient(app)

        # 1. Health
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

        # 2. Status
        r = client.get("/api/status")
        assert r.status_code == 200
        assert r.json()["count"] == 0

        # 3. Purge
        with patch("routers.cache.purge_cache", return_value={
            "success": True, "cleared": [".astro"], "message": "Local cache purged"
        }):
            r = client.post("/api/cache/purge")
            assert r.status_code == 200
            assert r.json()["success"] is True


def test_build_creates_sync_marker(tmp_path):
    """After successful mock build, .last_sync_success exists."""
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=WatcherStatus(
             pending=True, count=1, last_sync_at=None, files=[],
             lambda_files=[],
             has_product_changes=False,
             has_lambda_changes=False,
         )), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick")
        assert cfg.sync_marker_path.is_file()


def test_status_changes_after_sync(tmp_path):
    """After sync marker touched, status reflects the change."""
    from main import app

    cfg = _make_config(tmp_path)

    # Create a source file that's "modified"
    content_dir = cfg.src_dir / "content" / "reviews"
    content_dir.mkdir(parents=True)
    test_file = content_dir / "test-review.md"
    test_file.write_text("# Test", encoding="utf-8")

    client = TestClient(app)

    with patch("main.config", cfg), \
         patch("routers.status.get_pending_changes") as mock_status:

        # Before sync — 1 pending
        mock_status.return_value = WatcherStatus(
            pending=True, count=1, last_sync_at=None,
            files=[ChangedFile(
                path="src/content/reviews/test-review.md",
                file_type="NEW", category="review",
                mtime="2026-03-07T15:00:00Z",
            )],
            lambda_files=[],
            has_product_changes=False,
            has_lambda_changes=False,
        )
        r = client.get("/api/status")
        assert r.json()["count"] == 1

        # After sync — 0 pending
        mock_status.return_value = WatcherStatus(
            pending=False, count=0,
            last_sync_at="2026-03-07T16:00:00Z", files=[],
            lambda_files=[],
            has_product_changes=False,
            has_lambda_changes=False,
        )
        r = client.get("/api/status")
        assert r.json()["count"] == 0


def test_full_build_starts_with_cache_purge(tmp_path):
    """Full build SSE stream starts with a cache-purge event."""
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build._get_config", return_value=cfg), \
         patch("routers.build.purge_cache", return_value={
             "cleared": [".astro", "node_modules/.vite"]
         }):
        client = TestClient(app)
        r = client.post("/api/build/full")
        events = _parse_sse_events(r.text)
        stages = [e["stage"] for e in events]
        assert stages[0] == "cache-purge"


def test_409_during_active_build():
    """Concurrent POST returns 409 when build lock is held."""
    from main import app
    import routers.build as build_module

    loop = asyncio.new_event_loop()
    loop.run_until_complete(build_module._build_lock.acquire())

    try:
        client = TestClient(app, raise_server_exceptions=False)
        r = client.post("/api/build/quick")
        assert r.status_code == 409
    finally:
        build_module._build_lock.release()
        loop.close()


def test_dry_run_no_marker(tmp_path):
    """Dry-run build does NOT touch sync marker."""
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_commands", side_effect=_mock_stream_success), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick?dry_run=true")
        assert not cfg.sync_marker_path.exists()


def test_failed_build_no_marker(tmp_path):
    """Failed build does NOT touch sync marker."""
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream_failure), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick")
        assert not cfg.sync_marker_path.exists()
