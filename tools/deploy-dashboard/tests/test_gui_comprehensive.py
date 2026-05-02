"""
Comprehensive GUI test suite for the Deploy Dashboard.

Tests every API endpoint, SSE stream, simulation scenario, and validates
all backend contracts that drive the frontend UI.

Run: python -m pytest tests/test_gui_comprehensive.py -v
"""

from __future__ import annotations

import json
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from httpx import AsyncClient, ASGITransport
from tests.paths import UI_DIR


DASHBOARD_SOURCE = UI_DIR / "dashboard.jsx"


def _dashboard_source_text() -> str:
    return DASHBOARD_SOURCE.read_text(encoding="utf-8")

# â”€â”€ Fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture
def app():
    """Create a fresh app instance for testing."""
    # Patch config before importing main
    from config import AppConfig
    import tempfile
    tmp = Path(tempfile.mkdtemp())
    (tmp / "package.json").write_text("{}", encoding="utf-8")
    (tmp / "src").mkdir()
    (tmp / "dist" / "client").mkdir(parents=True)
    (tmp / "public").mkdir()

    test_config = AppConfig(
        project_root=tmp,
        src_dir=tmp / "src",
        dist_dir=tmp / "dist",
        dist_client_dir=tmp / "dist" / "client",
        public_dir=tmp / "public",
        astro_cache_dir=tmp / ".astro",
        vite_cache_dir=tmp / "node_modules" / ".vite",
        sync_marker_path=tmp / ".last_sync_success",
        s3_bucket="test-bucket",
        aws_region="us-east-2",
        cloudfront_distribution_id="E1TEST12345",
        port=8420,
    )

    with patch("main._validate_environment"):
        with patch("main.config", test_config):
            from main import app as fastapi_app
            yield fastapi_app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# A. APP BOOT & BASELINE RENDERING
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestAppBoot:
    """A. App boot and baseline rendering."""

    @pytest.mark.anyio
    async def test_root_returns_html(self, client):
        r = await client.get("/")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]
        assert "<div id=\"root\"></div>" in r.text

    @pytest.mark.anyio
    async def test_bundle_serves(self, client):
        r = await client.get("/app.bundle.js")
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        assert len(r.text) > 1000  # Bundle should be substantial

    @pytest.mark.anyio
    async def test_health_endpoint(self, client):
        r = await client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "project_root" in data
        assert "s3_bucket" in data

    @pytest.mark.anyio
    async def test_html_has_title(self, client):
        r = await client.get("/")
        assert "<title>EG Deploy Dashboard</title>" in r.text

    @pytest.mark.anyio
    async def test_html_has_dark_bg(self, client):
        r = await client.get("/")
        assert "#080c18" in r.text  # Dashboard dark background

    @pytest.mark.anyio
    async def test_html_shell_uses_root_scroller_without_body_zoom(self, client):
        r = await client.get("/")
        assert "zoom:1.25" not in r.text
        assert "overflow:hidden" in r.text
        assert "#root{height:100%;overflow:auto;}" in r.text


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# B. STATUS / POLLING ENDPOINT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestStatusEndpoint:
    """B/T. Status endpoint and polling behavior."""

    @pytest.mark.anyio
    async def test_status_returns_200(self, client):
        r = await client.get("/api/status")
        assert r.status_code == 200

    @pytest.mark.anyio
    async def test_status_has_required_fields(self, client):
        r = await client.get("/api/status")
        data = r.json()
        assert "pending" in data
        assert "count" in data
        assert "lastBuildAt" in data
        assert "lastDataSyncAt" in data
        assert "lastImageSyncAt" in data
        assert "hasProductChanges" in data
        assert "hasLambdaChanges" in data
        assert "hasPendingUploads" in data
        assert "hasPendingDataUploads" in data
        assert "hasPendingImageUploads" in data
        assert "pendingUploadCount" in data
        assert "pendingDataUploadCount" in data
        assert "pendingImageUploadCount" in data
        assert "files" in data
        assert isinstance(data["files"], list)

    @pytest.mark.anyio
    async def test_status_count_matches_files(self, client):
        r = await client.get("/api/status")
        data = r.json()
        assert data["count"] == len(data["files"])

    @pytest.mark.anyio
    async def test_status_pending_bool_matches_count(self, client):
        r = await client.get("/api/status")
        data = r.json()
        assert data["pending"] == (data["count"] > 0)

    @pytest.mark.anyio
    async def test_deploy_history_endpoint_returns_runs_list(self, client):
        r = await client.get("/api/deploy/history")
        assert r.status_code == 200
        data = r.json()
        assert "runs" in data
        assert isinstance(data["runs"], list)

    @pytest.mark.anyio
    async def test_system_health_endpoint_returns_metrics_list(self, client):
        r = await client.get("/api/system/health")
        assert r.status_code == 200
        data = r.json()
        assert "collectedAt" in data
        assert "metrics" in data
        assert isinstance(data["metrics"], list)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# C. SIMULATION ENDPOINTS â€” STATUS MOCKS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestSimulateStatus:
    """Simulation status endpoints for GUI testing."""

    @pytest.mark.anyio
    async def test_sim_status_pending(self, client):
        r = await client.get("/api/simulate/status/pending?count=6&lambda_changes=true")
        assert r.status_code == 200
        data = r.json()
        assert data["pending"] is True
        assert data["count"] == 6
        assert data["hasLambdaChanges"] is True
        assert len(data["files"]) == 6

    @pytest.mark.anyio
    async def test_sim_status_pending_with_products(self, client):
        r = await client.get("/api/simulate/status/pending?count=5&product_changes=true")
        data = r.json()
        assert data["hasProductChanges"] is True

    @pytest.mark.anyio
    async def test_sim_status_clean(self, client):
        r = await client.get("/api/simulate/status/clean")
        data = r.json()
        assert data["pending"] is False
        assert data["count"] == 0
        assert len(data["files"]) == 0
        assert data["hasProductChanges"] is False
        assert data["hasLambdaChanges"] is False

    @pytest.mark.anyio
    async def test_sim_status_files_have_required_fields(self, client):
        r = await client.get("/api/simulate/status/pending?count=3")
        data = r.json()
        for f in data["files"]:
            assert "path" in f
            assert "file_type" in f
            assert "category" in f
            assert "mtime" in f

    @pytest.mark.anyio
    async def test_sim_status_lambda_categories(self, client):
        r = await client.get("/api/simulate/status/pending?count=3&lambda_changes=true")
        data = r.json()
        cats = {f["category"] for f in data["files"]}
        assert cats & {"api", "auth", "search"}  # At least one Lambda category

    @pytest.mark.anyio
    async def test_simulate_fake_changes_returns_bucketed_summary(self, client):
        r = await client.post("/api/simulate/fake-changes")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "buckets" in data
        assert "files" in data
        assert isinstance(data["buckets"], list)
        assert isinstance(data["files"], list)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# D. SIMULATION ENDPOINTS â€” SSE BUILD STREAMS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestSimulateBuildStreams:
    """D/S. SSE stream simulation scenarios."""

    @pytest.mark.anyio
    async def test_quick_success_stream(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]

        events = _parse_sse_events(r.text)
        assert len(events) > 0

        stages = [e["stage"] for e in events]
        assert "build" in stages
        assert "sync" in stages
        assert "cdn" in stages
        assert "done" in stages

    @pytest.mark.anyio
    async def test_quick_success_has_uploads(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        uploads = [e for e in events if e["stage"] == "sync" and e["line"].startswith("upload:")]
        assert len(uploads) >= 10

    @pytest.mark.anyio
    async def test_quick_success_has_deletes(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        deletes = [e for e in events if e["stage"] == "sync" and e["line"].startswith("delete:")]
        assert len(deletes) >= 2

    @pytest.mark.anyio
    async def test_quick_success_has_cdn_invalidation_id(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        cdn_events = [e for e in events if e["stage"] == "cdn"]
        ids = [e for e in cdn_events if "InvalidationId" in e["line"]]
        assert len(ids) >= 1

    @pytest.mark.anyio
    async def test_full_success_stream(self, client):
        r = await client.post("/api/simulate/build/full-success?speed=0.001")
        events = _parse_sse_events(r.text)
        stages = [e["stage"] for e in events]
        assert "cache-purge" in stages
        assert "build" in stages
        assert "sync" in stages
        assert "cdn" in stages
        assert "done" in stages

    @pytest.mark.anyio
    async def test_full_success_more_uploads(self, client):
        r = await client.post("/api/simulate/build/full-success?speed=0.001")
        events = _parse_sse_events(r.text)
        uploads = [e for e in events if e["stage"] == "sync" and e["line"].startswith("upload:")]
        assert len(uploads) >= 20

    @pytest.mark.anyio
    async def test_build_failure_stream(self, client):
        r = await client.post("/api/simulate/build/failure?speed=0.001")
        events = _parse_sse_events(r.text)
        # Should have build events but NO done event
        stages = {e["stage"] for e in events}
        assert "build" in stages
        assert "done" not in stages
        # Should have error/FAILED lines
        error_lines = [e for e in events if "FAILED" in e["line"] or "error" in e["line"].lower()]
        assert len(error_lines) >= 1

    @pytest.mark.anyio
    async def test_sync_failure_stream(self, client):
        r = await client.post("/api/simulate/build/sync-failure?speed=0.001")
        events = _parse_sse_events(r.text)
        stages = {e["stage"] for e in events}
        assert "build" in stages
        assert "sync" in stages
        assert "done" not in stages
        error_lines = [e for e in events if "FAILED" in e["line"] or "AccessDenied" in e["line"]]
        assert len(error_lines) >= 1

    @pytest.mark.anyio
    async def test_cdn_failure_stream(self, client):
        r = await client.post("/api/simulate/build/cdn-failure?speed=0.001")
        events = _parse_sse_events(r.text)
        stages = {e["stage"] for e in events}
        assert "build" in stages
        assert "sync" in stages
        assert "cdn" in stages
        assert "done" not in stages
        error_lines = [e for e in events if "FAILED" in e["line"]]
        assert len(error_lines) >= 1


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# E. HEAVY LOAD SCENARIO
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestHeavyLoad:
    """Q. High-volume event handling."""

    @pytest.mark.anyio
    async def test_heavy_load_stream(self, client):
        r = await client.post(
            "/api/simulate/build/heavy-load?pages=50&uploads=80&deletes=15&speed=0.001"
        )
        events = _parse_sse_events(r.text)
        stages = {e["stage"] for e in events}
        assert "build" in stages
        assert "sync" in stages
        assert "cdn" in stages
        assert "done" in stages

        build_pages = [e for e in events if e["stage"] == "build" and e["line"].strip().startswith("built")]
        assert len(build_pages) == 50

        uploads = [e for e in events if e["stage"] == "sync" and e["line"].startswith("upload:")]
        assert len(uploads) == 80

        deletes = [e for e in events if e["stage"] == "sync" and e["line"].startswith("delete:")]
        assert len(deletes) == 15

    @pytest.mark.anyio
    async def test_heavy_load_category_distribution(self, client):
        r = await client.post("/api/simulate/build/heavy-load?pages=50&speed=0.001")
        events = _parse_sse_events(r.text)
        build_pages = [e["line"] for e in events if e["stage"] == "build" and "built" in e["line"]]
        categories = {"monitors", "keyboards", "mice", "headsets", "news"}
        found_cats = set()
        for line in build_pages:
            for cat in categories:
                if f"/{cat}/" in line:
                    found_cats.add(cat)
        assert found_cats == categories


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# F. LAMBDA SIMULATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestLambdaSimulation:
    """E/F. Lambda deploy scenarios."""

    @pytest.mark.anyio
    async def test_lambda_success_stream(self, client):
        r = await client.post("/api/simulate/lambda/deploy-success?speed=0.001")
        events = _parse_sse_events(r.text)
        stages = {e["stage"] for e in events}
        assert "lambda" in stages
        assert "done" in stages
        deploy_lines = [e for e in events if "v47" in e["line"]]
        assert len(deploy_lines) >= 1

    @pytest.mark.anyio
    async def test_lambda_failure_stream(self, client):
        r = await client.post("/api/simulate/lambda/deploy-failure?speed=0.001")
        events = _parse_sse_events(r.text)
        stages = {e["stage"] for e in events}
        assert "lambda" in stages
        assert "done" not in stages
        error_lines = [e for e in events if "FAILED" in e["line"] or "error" in e["line"].lower()]
        assert len(error_lines) >= 1


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# G. CDN STANDALONE SIMULATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestCDNSimulation:
    """L. CDN standalone invalidation mocks."""

    @pytest.mark.anyio
    async def test_cdn_invalidate_success(self, client):
        r = await client.post("/api/simulate/cdn/invalidate-success")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["distribution_id"] == "E1ITXKZVMDZMZ5"
        assert "/*" in data["paths"]

    @pytest.mark.anyio
    async def test_cdn_invalidate_failure(self, client):
        r = await client.post("/api/simulate/cdn/invalidate-failure")
        assert r.status_code == 500


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# H. CACHE PURGE SIMULATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestCachePurgeSimulation:
    """F. Cache purge mock scenarios."""

    @pytest.mark.anyio
    async def test_cache_purge_success(self, client):
        r = await client.post("/api/simulate/cache/purge-success")
        data = r.json()
        assert data["success"] is True
        assert ".astro" in data["cleared"]
        assert "node_modules/.vite" in data["cleared"]

    @pytest.mark.anyio
    async def test_cache_purge_clean(self, client):
        r = await client.post("/api/simulate/cache/purge-clean")
        data = r.json()
        assert data["success"] is True
        assert data["cleared"] == []
        assert "clean" in data["message"].lower()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# I. SSE EVENT FORMAT VALIDATION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestSSEFormat:
    """S. SSE event format and parsing."""

    @pytest.mark.anyio
    async def test_sse_event_has_required_fields(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        for event in events:
            assert "stage" in event, f"Missing 'stage' in event: {event}"
            assert "source" in event, f"Missing 'source' in event: {event}"
            assert "line" in event, f"Missing 'line' in event: {event}"
            assert "timestamp" in event, f"Missing 'timestamp' in event: {event}"

    @pytest.mark.anyio
    async def test_sse_stage_values_valid(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        valid_stages = {"build", "sync", "cdn", "done", "cache-purge", "lambda"}
        for event in events:
            assert event["stage"] in valid_stages, f"Invalid stage: {event['stage']}"

    @pytest.mark.anyio
    async def test_sse_source_values_valid(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        valid_sources = {"stdout", "stderr", "system"}
        for event in events:
            assert event["source"] in valid_sources, f"Invalid source: {event['source']}"

    @pytest.mark.anyio
    async def test_sse_timestamps_are_iso(self, client):
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        from datetime import datetime
        for event in events:
            # Should parse without error
            ts = event["timestamp"]
            assert "T" in ts, f"Timestamp not ISO format: {ts}"


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# J. LINE CLASSIFICATION (frontend logic validation)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestLineClassification:
    """H. Terminal log line classification."""

    def test_classify_upload(self):
        assert _classify("upload: s3://bucket/file.html") == "upload"

    def test_classify_delete(self):
        assert _classify("delete: s3://bucket/old-file.html") == "delete"

    def test_classify_error(self):
        assert _classify("fatal error: something broke") == "delete"

    def test_classify_failed(self):
        assert _classify("Build FAILED") == "delete"

    def test_classify_complete(self):
        assert _classify("Build complete") == "done"

    def test_classify_done(self):
        assert _classify("Done in 5.2s") == "done"

    def test_classify_html_page(self):
        assert _classify("  built /monitors/test/index.html") == "built"

    def test_classify_info_bracket(self):
        assert _classify("[build] Starting...") == "info"

    def test_classify_info_arrow(self):
        assert _classify("> Running astro build") == "info"

    def test_classify_info_starting(self):
        assert _classify("Starting: Astro Build") == "info"

    def test_classify_default_ok(self):
        assert _classify("some random log line") == "ok"


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# K. TIME AGO FORMATTING (frontend logic validation)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestTimeAgo:
    """N. Time formatting validation."""

    def test_just_now(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        assert _time_ago(now) == "just now"

    def test_minutes_ago(self):
        from datetime import datetime, timezone, timedelta
        past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        result = _time_ago(past)
        assert "m ago" in result

    def test_hours_ago(self):
        from datetime import datetime, timezone, timedelta
        past = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        result = _time_ago(past)
        assert "h ago" in result

    def test_days_ago(self):
        from datetime import datetime, timezone, timedelta
        past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        result = _time_ago(past)
        assert "d ago" in result


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# L. STAGE ORDER / PIPELINE PROGRESSION
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestPipelineProgression:
    """G. Stage order in build pipeline."""

    @pytest.mark.anyio
    async def test_quick_build_stage_order(self, client):
        """Stages must appear in order: build -> sync -> cdn -> done."""
        r = await client.post("/api/simulate/build/quick-success?speed=0.001")
        events = _parse_sse_events(r.text)
        stage_first_seen = {}
        for i, e in enumerate(events):
            if e["stage"] not in stage_first_seen:
                stage_first_seen[e["stage"]] = i

        assert stage_first_seen["build"] < stage_first_seen["sync"]
        assert stage_first_seen["sync"] < stage_first_seen["cdn"]
        assert stage_first_seen["cdn"] < stage_first_seen["done"]

    @pytest.mark.anyio
    async def test_full_build_starts_with_cache_purge(self, client):
        r = await client.post("/api/simulate/build/full-success?speed=0.001")
        events = _parse_sse_events(r.text)
        assert events[0]["stage"] == "cache-purge"


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# M. REAL CACHE PURGE ENDPOINT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class TestRealCachePurge:
    """F. Real cache purge endpoint."""

    @pytest.mark.anyio
    async def test_cache_purge_clean(self, client):
        r = await client.post("/api/cache/purge")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        # With temp dir, caches shouldn't exist
        assert data["cleared"] == []


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _parse_sse_events(text: str) -> list[dict]:
    """Parse SSE text stream into list of event dicts."""
    events = []
    for chunk in text.split("\n\n"):
        chunk = chunk.strip()
        if not chunk.startswith("data: "):
            continue
        try:
            data = json.loads(chunk[6:])
            events.append(data)
        except json.JSONDecodeError:
            pass
    return events


def _classify(line: str) -> str:
    """Python port of frontend classifyLineKind for validation."""
    if line.startswith("upload:"):
        return "upload"
    if line.startswith("delete:"):
        return "delete"
    if "error" in line or "FAILED" in line:
        return "delete"
    if "complete" in line or "Complete" in line or "Done" in line:
        return "done"
    if "/index.html" in line or ".html" in line:
        return "built"
    if line.startswith("[") or line.startswith(">") or line.startswith("Starting:"):
        return "info"
    return "ok"


def _time_ago(iso: str) -> str:
    """Python port of frontend timeAgo for validation."""
    from datetime import datetime, timezone
    dt = datetime.fromisoformat(iso)
    diff = (datetime.now(timezone.utc) - dt).total_seconds()
    mins = int(diff / 60)
    if mins < 1:
        return "just now"
    if mins < 60:
        return f"{mins}m ago"
    hrs = int(mins / 60)
    if hrs < 24:
        return f"{hrs}h ago"
    return f"{int(hrs / 24)}d ago"


class TestLambdaWatcherSurface:
    """Lambda watcher UI and simulation contract."""

    @pytest.mark.anyio
    async def test_bundle_contains_lambda_watcher_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "WATCHER" in r.text
        assert "No watched files changed" in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_lambda_watch_scope_paths(self, client):
        r = await client.get("/app.bundle.js")
        for watched_path in [
            "src/pages/api/",
            "src/pages/auth/",
            "src/pages/login/",
            "src/pages/logout.ts",
            "src/features/auth/server/",
            "src/features/search/",
        ]:
            assert watched_path in r.text

    @pytest.mark.anyio
    async def test_sim_status_pending_uses_server_auth_path(self, client):
        r = await client.get("/api/simulate/status/pending?count=5")
        data = r.json()
        paths = {item["path"] for item in data["files"]}
        assert "src/features/auth/server/cognito.ts" in paths
        assert "src/features/auth/store.ts" not in paths

    @pytest.mark.anyio
    async def test_sim_status_pending_includes_logout_watch_path(self, client):
        r = await client.get("/api/simulate/status/pending?count=4")
        data = r.json()
        paths = {item["path"] for item in data["files"]}
        assert "src/pages/logout.ts" in paths


class TestLambdaWorkflowBundle:
    """Lambda-only workflow bundle contract."""

    @pytest.mark.anyio
    async def test_bundle_contains_lambda_storyboard_stages(self, client):
        r = await client.get("/app.bundle.js")
        for label in [
            "Packaging Lambda Artifact",
            "Uploading Lambda Artifact",
            "Deploy Stack",
            "Refresh Stack Outputs",
        ]:
            assert label in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_lambda_tab_and_site_panel_guardrails(self, client):
        r = await client.get("/app.bundle.js")
        assert "Lambda Deploy" in r.text
        assert "Lambda deployment does not update page build rows." in r.text
        assert "Lambda deployment does not update category progress." in r.text

    @pytest.mark.anyio
    async def test_bundle_restores_three_storyboard_sections(self, client):
        r = await client.get("/app.bundle.js")
        assert "Monitors" in r.text
        assert "Site Pipeline" in r.text
        assert "Lambda Pipeline" in r.text

    @pytest.mark.anyio
    async def test_bundle_removes_broken_mojibake_labels(self, client):
        r = await client.get("/app.bundle.js")
        assert "ÃŽÂ» Deploy Lambda" not in r.text
        assert "Ã¢â€”Ë† Operation Storyboard" not in r.text
        assert "Ã¢Å Å¾ Page Build Matrix" not in r.text
        assert "Ã°Å¸Å’Â Invalidate CDN" not in r.text

    def test_dashboard_source_has_no_mojibake_sequences(self):
        text = _dashboard_source_text()
        for broken in ["Ã¢", "Ã°Å¸", "ÃŽ", "Ã‚"]:
            assert broken not in text

    def test_dashboard_source_keeps_main_panel_bounded_alongside_sidebar(self):
        text = _dashboard_source_text()
        assert 'const MAIN_BODY_PANEL_HEIGHT = 1200;' in text
        assert 'alignItems:"stretch"' in text
        assert 'gridTemplateColumns:"minmax(0,1fr) 300px"' in text
        assert 'display:"flex",flexDirection:"column",gap:12' in text
        assert 'display:"flex",flexDirection:"column",gap:12,minHeight:0,minWidth:0' in text
        assert 'display:"flex",flexDirection:"column",flex:1,minHeight:0,minWidth:0,height:"100%"' in text
        assert 'display:"flex",flexDirection:"column",gap:11,minHeight:0,overflowY:"auto"' in text

    def test_dashboard_source_uses_fixed_heights_for_sidebar_panels(self):
        text = _dashboard_source_text()
        assert 'const SIDEBAR_PANEL_HEIGHTS = {' in text
        assert 'changedFiles: 420,' in text
        assert 'infraDependencies: 480,' in text
        assert 'deployHistory: 170,' in text
        assert 'serverHealth: 190,' in text
        assert 'style={{height:SIDEBAR_PANEL_HEIGHTS.changedFiles}}' in text
        assert 'style={{flex:1,minHeight:0}}' in text
        assert 'DEPLOY HISTORY' in text
        assert 'SERVER HEALTH' in text
        assert 'display:"flex",flexDirection:"column",gap:4,flex:1,minHeight:0,overflowY:"auto"' in text
        assert "pendingFiles.slice(0,7)" not in text
        assert '<Panel loading={isPanelLoading} title={`Changed Files (${pendingCount})`} icon="FILES" accent={T.yellow+"33"} style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>' not in text

    def test_dashboard_source_uses_window_origin_for_api_calls(self):
        text = _dashboard_source_text()
        assert 'const API_BASE = window.location.origin;' in text
        assert 'const API_BASE = "http://localhost:8420";' not in text

    def test_dashboard_source_lambda_tab_uses_lane_stage_helpers(self):
        text = _dashboard_source_text()
        assert 'stageState(s.key)' not in text
        assert 'laneStageState("lambda", s.key)' in text
        assert 'stageTilePct("lambda", s.key)' in text

    def test_dashboard_source_wraps_terminal_lines_without_horizontal_growth(self):
        text = _dashboard_source_text()
        assert 'whiteSpace:"pre-wrap"' in text
        assert 'overflowWrap:"anywhere"' in text
        assert 'overflowX:"hidden"' in text

    def test_dashboard_source_lambda_tab_fills_panel_height_and_scrolls_inside(self):
        text = _dashboard_source_text()
        assert 'activeTab==="lambda"&&(' in text
        assert 'padding:"14px",display:"flex",flexDirection:"column",flex:1,minHeight:0' in text
        assert 'flex:1,minHeight:0,overflowY:"auto"' in text
        assert 'maxHeight:260' not in text

    def test_dashboard_source_separates_lambda_tab_from_site_build_tabs(self):
        text = _dashboard_source_text()
        assert 'const SITE_BUILD_PANEL_TABS = [' in text
        assert 'const LAMBDA_PANEL_TAB = { key:"lambda", label:"Lambda Deploy" };' in text
        assert 'width:1,height:16,background:T.borderB,margin:"0 8px 0 4px",flexShrink:0' in text
        assert 'SITE_BUILD_PANEL_TABS.map(renderPanelTab)' in text
        assert '{renderPanelTab(LAMBDA_PANEL_TAB)}' in text
        assert '[["terminal","Terminal Log"],["lambda","Lambda Deploy"],["matrix","Page Build Matrix"],["categories","Category Rings"],["s3sync","S3 Sync"],["cdntab","CDN"]].map(([k,l])=>(' not in text

    def test_dashboard_source_animates_live_tabs_for_active_panel_streams(self):
        text = _dashboard_source_text()
        assert 'const getTabLiveMeta = (key) => {' in text
        assert 'if (key === "terminal") return isRunning ? { color:pCol, label:"LIVE" } : null;' in text
        assert 'if (key === "matrix" || key === "categories") return isSiteMode && phase === "building" ? { color:T.blue, label:"LIVE" } : null;' in text
        assert 'if (key === "s3sync") return isSiteMode && phase === "syncing" ? { color:T.purple, label:"LIVE" } : null;' in text
        assert 'if (key === "cdntab") return isSiteMode && phase === "cdn" ? { color:T.green, label:"LIVE" } : null;' in text
        assert 'if (key === "lambda") return isLambdaMode && ["lambda-package","lambda-upload","lambda-deploy","lambda-live"].includes(phase) ? { color:pCol, label:"LIVE" } : null;' in text
        assert 'const renderPanelTab = ({ key, label }) => {' in text
        assert 'SITE_BUILD_PANEL_TABS.map(renderPanelTab)' in text
        assert '{renderPanelTab(LAMBDA_PANEL_TAB)}' in text
        assert 'animation:"pulse 1.2s ease-in-out infinite"' in text
        assert 'animation:"sweep 1.8s linear infinite"' in text

    def test_dashboard_source_primary_tabs_fill_panel_height_and_scroll_inside(self):
        text = _dashboard_source_text()
        for tab_key in [
            'activeTab==="terminal"&&(',
            'activeTab==="lambda"&&(',
            'activeTab==="matrix"&&(',
            'activeTab==="categories"&&(',
            'activeTab==="s3sync"&&(',
            'activeTab==="cdntab"&&(',
        ]:
            assert tab_key in text
        assert text.count('display:"flex",flexDirection:"column",flex:1,minHeight:0') >= 6
        assert text.count('flex:1,minHeight:0,overflowY:"auto"') >= 5
        assert 'ref={termRef} style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden"' in text
        assert 'maxHeight:320,overflowY:"auto"' not in text
        assert 'maxHeight:280,overflowY:"auto"' not in text
        assert 'minHeight:150' not in text

    def test_dashboard_source_places_completion_summary_above_the_tabbed_run_panels(self):
        text = _dashboard_source_text()
        left_column_source = text.split('{/* LEFT: tabs with terminal + matrix */}', 1)[1].split('{/* RIGHT SIDEBAR */}', 1)[0]
        assert left_column_source.index('{/* Completion summary */}') < left_column_source.index('{/* Tabbed terminal/matrix */}')
        assert left_column_source.index('{completionSummaryTitle}') < left_column_source.index('SITE_BUILD_PANEL_TABS.map(renderPanelTab)')

    def test_dashboard_source_keeps_completion_summary_visible_and_dims_idle_state(self):
        text = _dashboard_source_text()
        completion_summary_source = text.split('{/* Completion summary */}', 1)[1].split('{/* Tabbed terminal/matrix */}', 1)[0]
        assert 'const completionSummaryTone = phase==="done" ? "complete" : latestDeployRun ? "history" : "idle";' in text
        assert 'const completionSummaryTitle = phase==="done"' in text
        assert 'latestDeployRun ? `${latestDeployRun.label} Deployment | ${(latestDeployRun.durationSeconds || 0).toFixed(1)}s total`' in text
        assert ': "Awaiting Deployment Run";' in text
        assert 'const completionSummaryMetrics = phase==="done" ? [' in text
        assert 'latestDeployRun ? latestDeployRun.pagesBuilt : 0' in text
        assert 'latestDeployRun ? latestDeployRun.uploaded : 0' in text
        assert 'latestDeployRun ? latestDeployRun.deleted : 0' in text
        assert 'latestDeployRun ? latestDeployRun.cdnPaths : 0' in text
        assert 'latestDeployRun?.lambdaVersion != null ? `v${latestDeployRun.lambdaVersion}` : "--"' in text
        assert '{phase==="done"&&(' not in completion_summary_source
        assert 'Awaiting Deployment Run' in text
        assert 'background:completionSummaryTone==="complete"' in completion_summary_source
        assert 'c:completionSummaryTone==="idle" ? ink(0.22) : T.cyan' in text

    @pytest.mark.anyio
    async def test_bundle_locks_main_body_to_viewport_and_keeps_tab_panels_internal(self, client):
        r = await client.get("/app.bundle.js")
        assert 'height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"' in r.text
        assert 'overflowY:"auto",overflowX:"hidden",padding:"14px 20px 0",display:"flex",flexDirection:"column",gap:12' in r.text
        assert 'gridTemplateColumns:"minmax(0,1fr) 300px",gap:12,alignItems:"stretch",height:' in r.text
        assert ',minHeight:' in r.text
        assert 'display:"flex",flexDirection:"column",flex:1,minHeight:0,minWidth:0,height:"100%"' in r.text

    def test_dashboard_source_locks_main_body_to_viewport_and_keeps_tab_panels_internal(self):
        text = _dashboard_source_text()
        assert 'height:"100vh"' in text
        assert 'overflow:"hidden"' in text
        assert 'const MAIN_BODY_PANEL_HEIGHT = 1200;' in text
        assert 'display:"flex",flexDirection:"column",gap:12' in text
        assert 'gridTemplateColumns:"minmax(0,1fr) 300px",gap:12,alignItems:"stretch",height:MAIN_BODY_PANEL_HEIGHT,minHeight:MAIN_BODY_PANEL_HEIGHT' in text
        assert 'display:"flex",flexDirection:"column",gap:12,minHeight:0,minWidth:0' in text
        assert 'display:"flex",flexDirection:"column",flex:1,minHeight:0,minWidth:0,height:"100%"' in text

    def test_dashboard_source_places_footer_inside_content_flow_after_main_body(self):
        text = _dashboard_source_text()
        assert '\n          <div style={{padding:"8px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>' in text
        assert '\n        <div style={{padding:"8px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>' not in text
        assert 'overflowY:"auto",overflowX:"hidden",padding:"14px 20px 0",display:"flex",flexDirection:"column",gap:12' in text
        assert 'overflowY:"auto",overflowX:"hidden",padding:"14px 20px 24px",display:"flex",flexDirection:"column",gap:12' not in text

    def test_dashboard_source_s3_tab_autoscrolls_and_wraps_full_paths(self):
        text = _dashboard_source_text()
        s3_tab_source = text.split('{/* S3 SYNC TAB */}', 1)[1].split('{/* CDN TAB */}', 1)[0]
        assert 'const s3Ref    = useRef(null);' in text
        assert 'useEffect(() => { if (s3Ref.current) s3Ref.current.scrollTop = s3Ref.current.scrollHeight; }, [syncFiles]);' in text
        assert 'ref={s3Ref} style={{flex:1,minHeight:0,overflowY:"auto"}}' in s3_tab_source
        assert 'whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word"' in s3_tab_source
        assert 'textOverflow:"ellipsis"' not in s3_tab_source
        assert 'whiteSpace:"nowrap"' not in s3_tab_source

    def test_dashboard_source_s3_tab_splits_sync_activity_into_four_scoped_subtabs(self):
        text = _dashboard_source_text()
        s3_tab_source = text.split('{/* S3 SYNC TAB */}', 1)[1].split('{/* CDN TAB */}', 1)[0]
        assert 'const [activeS3SyncSubtab, setActiveS3SyncSubtab] = useState("data-upload");' in text
        assert 'const _S3_SYNC_SUBTABS = [' in text
        for label in ["DATA UPLOAD", "IMAGES UPLOAD", "DATA DELETE", "IMAGES DELETE"]:
            assert f'label:"{label}"' in text
        assert 'scope: classifySyncFileScope(line),' in text
        assert 'const visibleSyncFiles = syncFiles.filter(file =>' in text
        assert 'file.scope === activeS3SyncSubtabMeta.scope && file.op === activeS3SyncSubtabMeta.op' in text
        assert 'syncFiles.filter(file => file.scope === tab.scope && file.op === tab.op).length' in s3_tab_source

    def test_dashboard_source_fetches_live_deploy_history_and_server_health_panels(self):
        text = _dashboard_source_text()
        assert 'fetch(`${API_BASE}/api/deploy/history`)' in text
        assert 'fetch(`${API_BASE}/api/system/health`)' in text
        assert 'const [deployHistory, setDeployHistory] = useState([]);' in text
        assert 'const [serverHealthMetrics, setServerHealthMetrics] = useState([]);' in text
        assert 'const [serverHealthCollectedAt, setServerHealthCollectedAt] = useState(null);' in text
        assert 'HISTORY.map((h,i)=>(' not in text
        assert 'Build Cache", v:847' not in text
        assert 'serverHealthMetrics.map(metric => (' in text
        assert 'deployHistory.map(entry => (' in text

    def test_dashboard_source_replaces_deployment_vitals_placeholders_with_live_values(self):
        text = _dashboard_source_text()
        deployment_vitals_source = text.split('{/* Deployment Vitals */}', 1)[1].split('{/* S3 State */}', 1)[0]
        assert 'fetch(`${API_BASE}/api/health`)' in text
        assert 'const [deployTarget, setDeployTarget] = useState({ bucket: "", region: "" });' in text
        assert 'const latestDeployRun = deployHistory[0] || null;' in text
        assert 'const imageUploadCount = syncFiles.filter(file => file.scope === "images" && file.op === "upload").length;' in text
        assert 'const deploymentErrorLineCount = termLines.filter(line => line.kind === "delete" && !line.text.startsWith("delete:")).length;' in text
        assert 'const deploymentErrorRate = observedOperationCount > 0' in text
        assert 'latestDeployRun ? `#${latestDeployRun.id}` : "--"' in text
        assert 'pendingCount > 0 ? `${pendingCount.toLocaleString()} files` : "0 files"' in text
        assert 'deployTarget.bucket ? `s3://${deployTarget.bucket}` : "--"' in text
        assert 'v:`${imageUploadCount} uploaded`' in text
        assert '"12234-354379"' not in deployment_vitals_source
        assert '"6,672 files"' not in deployment_vitals_source
        assert '"s3://techreviews"' not in deployment_vitals_source
        assert '"847 compressed"' not in deployment_vitals_source

    def test_dashboard_source_places_single_fake_random_changes_button_in_changed_files_header(self):
        text = _dashboard_source_text()
        changed_files_source = text.split('{/* Changed files */}', 1)[1].split('{/* Infra dependencies */}', 1)[0]
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'const [fakeChangesBusy, setFakeChangesBusy] = useState(false);' in text
        assert 'const [fakeChangesSummary, setFakeChangesSummary] = useState(null);' not in text
        assert 'const startFakeChanges = useCallback(() => {' in text
        assert 'fetch(`${API_BASE}/api/simulate/fake-changes`, { method: "POST" })' in text
        assert 'refreshStatus();' in text
        assert 'function Panel({ title, icon, children, accent, style: sx, loading, headerRight }) {' in text
        assert 'headerRight={(' in changed_files_source
        assert 'SIMULATE CHANGES' in changed_files_source
        assert 'PURGE CACHE' in changed_files_source
        assert 'const fakeChangesHeaderText = fakeChangesSummary' not in text
        assert '"Touch mtimes only"' not in text
        assert '{fakeChangesHeaderText}' not in changed_files_source
        assert 'SIMULATE CHANGES' not in controls_source
        assert 'PURGE CACHE' not in controls_source
        assert text.count('SIMULATE CHANGES') == 1
        assert 'Touched ${fakeChangesSummary.totalTouched} files' not in text
        assert 'FAKE RANDOM FILE CHANGES' not in text

    def test_dashboard_source_confirms_fake_random_changes_before_request(self):
        text = _dashboard_source_text()
        assert 'window.confirm(' in text
        assert 'Touch a random sample of real project files by updating modified times only.' in text
        assert 'No file contents are changed.' in text
        assert 'Are you sure you want to continue?' in text

    def test_dashboard_source_separates_changed_files_from_images_and_shows_real_file_type(self):
        text = _dashboard_source_text()
        changed_files_source = text.split('{/* Changed files */}', 1)[1].split('{/* Infra dependencies */}', 1)[0]
        assert 'const [activeChangedFilesSubtab, setActiveChangedFilesSubtab] = useState("files");' in text
        assert 'const _CHANGED_FILE_SUBTABS = [' in text
        assert 'label:"FILES"' in text
        assert 'label:"IMAGES"' in text
        assert 'const visiblePendingFiles = activeChangedFilesSubtab === "images"' in text
        assert '? allPendingFiles.filter(file => file.category === "image")' in text
        assert ': pendingFiles.filter(file => file.category !== "image")' in text
        assert 'file.category === "image"' in text
        assert 'file.category !== "image"' in text
        assert 'CHANGED_FILE_SUBTABS.map(tab => {' in changed_files_source
        assert 'const count = tab.key === "images"' in changed_files_source
        assert '? allPendingFiles.filter(file => file.category === "image").length' in changed_files_source
        assert ': pendingFiles.filter(file => file.category !== "image").length;' in changed_files_source
        assert 'visiblePendingFiles.length === 0 ? (' in changed_files_source
        assert '{(f.file_type || "MODIFIED").toUpperCase()}' in changed_files_source
        assert '>MODIFIED</span>' not in changed_files_source

    def test_dashboard_source_publish_updates_controls_do_not_render_duplicate_fake_changes_trigger(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'Publish Updates' in controls_source
        assert 'Touch sample source files so Publish Updates has a realistic mixed pending set.' not in controls_source
        assert 'SIMULATE CHANGES' not in controls_source
        assert 'PURGE CACHE' not in controls_source

    def test_dashboard_source_adds_split_quick_publish_actions_under_publish_updates(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'Publish Updates' in controls_source
        assert 'Cached Astro build to S3 mirror (upload and delete) to targeted CDN invalidation' in controls_source
        assert 'Astro Publish' in controls_source
        assert 'S3 Data Publish' in controls_source
        assert 'S3 Image Publish' in controls_source
        assert 'Cached Astro build only' in controls_source
        assert 'Content/data upload only' in controls_source
        assert 'Images upload only' in controls_source
        assert 'startSiteOperation(`${API_BASE}/api/build/quick`, "building")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/astro-publish`, "building")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/s3-data-publish`, "syncing", "s3sync")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/s3-image-publish`, "syncing", "s3sync")' in text

    def test_dashboard_source_disables_incremental_publish_buttons_when_watcher_is_clean(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'const [pendingUploadCount, setPendingUploadCount] = useState(0);' in text
        assert 'const [pendingDataUploadCount, setPendingDataUploadCount] = useState(0);' in text
        assert 'const [pendingImageUploadCount, setPendingImageUploadCount] = useState(0);' in text
        assert 'const publishControlsDisabled = isRunning || (pendingCount === 0 && pendingUploadCount === 0);' in text
        assert 'const astroPublishDisabled = isRunning || pendingCount === 0;' in text
        assert 'const dataRebuildDisabled = isRunning;' in text
        assert 'const imageRebuildDisabled = isRunning;' in text
        assert 'disabled={publishControlsDisabled}' in controls_source
        assert 'disabled={astroPublishDisabled}' in controls_source
        assert 'disabled={dataRebuildDisabled}' in controls_source
        assert 'disabled={imageRebuildDisabled}' in controls_source
        assert 'No pending source changes or uploads' in controls_source

    def test_dashboard_source_keeps_split_s3_buttons_available_as_force_actions(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'pendingDataUploadCount === 0' not in controls_source
        assert 'pendingImageUploadCount === 0' not in controls_source
        assert 'S3 Data Rebuild' in controls_source
        assert 'S3 Image Rebuild' in controls_source

    def test_dashboard_source_reads_upload_state_from_status_payload(self):
        text = _dashboard_source_text()
        assert 'setPendingUploadCount(data.pendingUploadCount || 0);' in text
        assert 'setPendingDataUploadCount(data.pendingDataUploadCount || 0);' in text
        assert 'setPendingImageUploadCount(data.pendingImageUploadCount || 0);' in text

    def test_dashboard_source_adds_publish_queue_panel_under_lambda_and_cache_controls(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'Publish Queue' in controls_source
        assert 'gridTemplateColumns:"repeat(3,minmax(0,1fr))"' in controls_source
        assert 'gridColumn:"1 / span 2"' not in controls_source
        assert 'gridColumn:"3 / span 2"' not in controls_source
        assert 'BUILD' in controls_source
        assert 'DATA' in controls_source
        assert 'IMAGES' in controls_source
        assert 'CDN' in controls_source
        assert 'CDN Queue Log' in controls_source
        assert 'upload ready' in text
        assert 'Deploy Lambda' not in controls_source
        assert 'Purge Cache' not in controls_source

    def test_dashboard_source_moves_purge_cache_into_changed_files_header_as_equal_width_action(self):
        text = _dashboard_source_text()
        changed_files_source = text.split('{/* Changed files */}', 1)[1].split('{/* Infra dependencies */}', 1)[0]
        assert 'PURGE CACHE' in changed_files_source
        assert 'fetch(`${API_BASE}/api/cache/purge`, { method: "POST" })' in text
        assert 'display:"grid"' in changed_files_source
        assert 'gridTemplateColumns:"repeat(2, minmax(0, 1fr))"' in changed_files_source
        assert 'width:"100%"' in changed_files_source

    def test_dashboard_source_confirms_cache_purge_before_request_with_full_rebuild_warning(self):
        text = _dashboard_source_text()
        assert 'Purge the local Astro/Vite caches before the next publish?' in text
        assert 'This clears .astro and node_modules/.vite.' in text
        assert 'The next Astro publish will rebuild from a cold cache.' in text
        assert 'It resets the site, data, and image pending markers so the next publish starts cold.' in text
        assert 'Are you sure you want to purge the cache?' in text

    def test_dashboard_source_refreshes_system_health_after_successful_cache_purge(self):
        text = _dashboard_source_text()
        assert 'const refreshServerHealth = useCallback(() => {' in text
        assert 'const refreshStatus = useCallback((fullFileList = false) => {' in text
        assert 'fetch(`${API_BASE}/api/system/health`)' in text
        cache_purge_source = text.split('const startCachePurge = useCallback(() => {', 1)[1].split('const deploymentErrorLineCount =', 1)[0]
        assert 'refreshStatus();' in cache_purge_source
        assert 'refreshServerHealth();' in cache_purge_source

    def test_dashboard_source_moves_deploy_lambda_button_into_lambda_command_center_footer(self):
        text = _dashboard_source_text()
        lambda_panel_source = text.split('{/* Lambda Command Center */}', 1)[1].split('{/* SECTION 2: CONTROLS */}', 1)[0]
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'Deploy Lambda' in lambda_panel_source
        assert 'Package + deploy' in lambda_panel_source
        assert 'gridTemplateColumns:"1fr 1fr 1fr",gap:6' in lambda_panel_source
        assert 'Deploy Lambda' not in controls_source
        assert 'startLambdaDeploy()' in lambda_panel_source

    def test_dashboard_source_defines_cache_purge_callback_after_is_running_state(self):
        text = _dashboard_source_text()
        assert text.index('const isRunning = [') < text.index('const startCachePurge = useCallback(() => {')

    def test_dashboard_source_refreshes_publish_state_immediately_when_stream_done_event_arrives(self):
        text = _dashboard_source_text()
        assert 'if (payload.stage === "done") {' in text
        assert 'refreshStatus();' in text
        assert 'refreshSidebarInsights();' in text

    def test_dashboard_source_does_not_treat_astro_publish_stack_refresh_as_s3_activity(self):
        text = _dashboard_source_text()
        assert 'const [siteOperationProfile, setSiteOperationProfile] = useState("default");' in text
        assert 'const isBuildOnlySiteProfile = siteOperationProfile === "astro-publish" || siteOperationProfile === "astro-rebuild";' in text
        assert 'const isBuildOnlyStackRefreshLine = isBuildOnlySiteProfile' in text
        assert 'stage === "sync"' in text
        assert 'line.startsWith("Starting: Refreshing Stack Outputs")' in text
        assert 'if (stage === "sync" && !isBuildOnlyStackRefreshLine)  { setRunMode("site"); setPhase("syncing"); }' in text

    def test_dashboard_source_wraps_panel_header_actions_and_loading_spinner_cleanly(self):
        text = _dashboard_source_text()
        panel_source = text.split('function Panel({ title, icon, children, accent, style: sx, loading, headerRight }) {', 1)[1].split('/* MATRIX ROW */', 1)[0]
        assert 'justifyContent:"space-between"' in panel_source
        assert 'flexWrap:"wrap"' in panel_source
        assert 'borderRadius:999' in panel_source
        assert 'Loading' in panel_source

    def test_dashboard_source_places_panel_loading_chip_next_to_title_before_header_actions(self):
        text = _dashboard_source_text()
        panel_source = text.split('function Panel({ title, icon, children, accent, style: sx, loading, headerRight }) {', 1)[1].split('/* MATRIX ROW */', 1)[0]
        assert '{(headerRight || loading) && (' not in panel_source
        assert '{loading && (' in panel_source
        assert '{headerRight && (' in panel_source
        assert panel_source.index('{loading && (') < panel_source.index('{headerRight && (')

    def test_dashboard_source_groups_split_rebuild_actions_under_force_full_rebuild(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        rebuild_section = controls_source.split('<span>Force Full Rebuild</span>', 1)[1].split('Split the full rebuild into individual site stages with live matrix, S3 sync, and CDN panel updates', 1)[0]
        assert 'Force Full Rebuild' in controls_source
        assert 'gridTemplateColumns:"repeat(4,minmax(0,1fr))"' in rebuild_section
        assert 'gridTemplateColumns:"repeat(2,minmax(0,1fr))"' not in rebuild_section
        assert 'Astro Rebuild' in controls_source
        assert 'S3 Data Rebuild' in controls_source
        assert 'S3 Image Rebuild' in controls_source
        assert 'CDN Flush' in controls_source
        assert 'const startSiteOperation = useCallback((endpoint, initialPhase, tab = "terminal", failurePrefix = "Connection error") => {' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/full`, "building")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/astro-rebuild`, "building")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/s3-data-rebuild`, "syncing", "s3sync")' in text
        assert 'startSiteOperation(`${API_BASE}/api/build/s3-image-rebuild`, "syncing", "s3sync")' in text
        assert "startSiteOperation(`${API_BASE}/api/cdn/invalidate/live`, \"cdn\", \"cdntab\", \"CDN invalidation error\");" in text
        assert 'Invalidate CDN' not in controls_source

    def test_dashboard_source_aligns_publish_rebuild_and_queue_cards_under_the_three_top_panels(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]

        assert 'display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,alignItems:"stretch"' in controls_source
        assert controls_source.count('background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6') >= 3
        assert 'gridColumn:"1 / span 2"' not in controls_source
        assert 'gridColumn:"3 / span 2"' not in controls_source

    def test_dashboard_source_tracks_split_quick_publish_profiles(self):
        text = _dashboard_source_text()
        assert 'endpoint.endsWith("/api/build/s3-data-publish")' in text
        assert '"s3-data-publish"' in text
        assert 'endpoint.endsWith("/api/build/s3-image-publish")' in text
        assert '"s3-image-publish"' in text

    def test_dashboard_source_split_rebuild_labels_describe_data_vs_image_scope(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]
        assert 'S3 Data Rebuild' in controls_source
        assert 'S3 Image Rebuild' in controls_source
        assert 'Content/data only' in controls_source
        assert 'Images only' in controls_source

    def test_dashboard_source_s3_state_panel_uses_real_resources_and_scoped_counts(self):
        text = _dashboard_source_text()
        s3_panel_source = text.split('{/* S3 State */}', 1)[1].split('{/* Lambda Command Center */}', 1)[0]
        assert 'function parseS3TransferSummaryLine(line) {' in text
        assert 'const [s3PreviewSummary, setS3PreviewSummary] = useState({' in text
        assert 'const s3ResourceCards = infraResources.slice(0, 4);' in text
        assert 'const s3PanelStatCards = [' in text
        assert 'Preview Delta' in s3_panel_source
        assert 'Observed Ops' in s3_panel_source
        assert 'DATA UP' in text
        assert 'IMG UP' in text
        assert 'DATA DEL' in text
        assert 'IMG DEL' in text
        assert 'Pending Files' not in s3_panel_source
        assert 'const parsedS3Summary = parseS3TransferSummaryLine(line);' in text
        assert 'infraResources.map' not in s3_panel_source
        assert 's3ResourceCards.map(resource => (' in s3_panel_source
        for placeholder in ['QuickCDN Mem', 'Not\\nNeeded', 'eggeer-tac', 'eg-tac-prod-operations']:
            assert placeholder not in s3_panel_source

    def test_dashboard_source_cdn_tab_parses_real_invalidation_metrics_and_permission_failures(self):
        text = _dashboard_source_text()
        cdn_tab_source = text.split('{/* CDN TAB */}', 1)[1].split('{/* Completion summary */}', 1)[0]
        assert 'function parseCdnSubmissionLine(line) {' in text
        assert 'function parseCdnGroupLine(line) {' in text
        assert 'function parseCdnInvalidationSummaryLine(line) {' in text
        assert 'function parseCdnStatusLine(line) {' in text
        assert 'function parseCdnCommandLine(line) {' in text
        assert 'function parseCdnErrorLine(line) {' in text
        assert 'const [cdnMetrics, setCdnMetrics] = useState({' in text
        assert 'const parsedCdnSubmission = parseCdnSubmissionLine(line);' in text
        assert 'const parsedCdnGroup = parseCdnGroupLine(line);' in text
        assert 'const parsedCdnInvalidation = parseCdnInvalidationSummaryLine(line);' in text
        assert 'const parsedCdnStatus = parseCdnStatusLine(line);' in text
        assert 'const parsedCdnCommand = parseCdnCommandLine(line);' in text
        assert 'const parsedCdnError = parseCdnErrorLine(line);' in text
        assert 'Planned Paths' in cdn_tab_source
        assert 'Groups' in cdn_tab_source
        assert 'Invalidations' in cdn_tab_source
        assert 'Polling' in cdn_tab_source
        assert 'Last Error' in cdn_tab_source
        assert 'Distribution:' not in cdn_tab_source
        assert 'Events:' not in cdn_tab_source
        assert 'E1ITXKZVMDZMZ5' not in cdn_tab_source

    def test_dashboard_source_cdn_tab_marks_unverified_invalidations_without_sticking_in_running(self):
        text = _dashboard_source_text()

        assert 'unverifiedInvalidationIds' in text
        assert 'parsedCdnStatus.status === "UNVERIFIED"' in text
        assert 'cdnPollingState === "UNVERIFIED"' in text
        assert 'unverified invalidation' in text

    def test_dashboard_source_manual_cdn_flush_seeds_full_mode_and_filters_lambda_live_noise(self):
        text = _dashboard_source_text()

        assert 'endpoint.endsWith("/api/cdn/invalidate/live")' in text
        assert 'SITE_FULL_INVALIDATION_PATHS' in text
        assert 'const pathMetrics = buildCdnPathMetrics(SITE_FULL_INVALIDATION_PATHS);' in text
        assert 'mode: "FULL"' in text
        assert 'currentAction: "resolving stack outputs"' in text
        assert 'plannedPaths: pathMetrics.paths' in text
        assert 'PLANNED INVALIDATION PATHS' in text
        assert 'const isCdnNoiseLine = line.startsWith("[lambda] stage lambda-live ");' in text
        assert '[cdn] ${payload.progress || 0}% ${payload.detail || ""}' in text

    def test_dashboard_source_marks_each_planned_cdn_path_with_live_status(self):
        text = _dashboard_source_text()
        cdn_tab_source = text.split('PLANNED INVALIDATION PATHS', 1)[1]

        assert 'getCdnPathStateLabel(' in text
        assert 'const cdnPathState = getCdnPathStateLabel(displayCdnMetrics, pathValue);' in cdn_tab_source
        assert 'cdnPathState === "cleared"' in cdn_tab_source
        assert 'cdnPathState === "unverified"' in cdn_tab_source
        assert 'cdnPathState === "in-flight"' in cdn_tab_source
        assert 'CLEARED' in cdn_tab_source
        assert 'UNVERIFIED' in cdn_tab_source
        assert 'IN FLIGHT' in cdn_tab_source

    def test_dashboard_source_queues_smart_publish_paths_and_exposes_standalone_cdn_publish(self):
        text = _dashboard_source_text()
        controls_source = text.split('{/* SECTION 2: CONTROLS */}', 1)[1].split('{/* SECTION 3: OPERATION STORYBOARD */}', 1)[0]

        assert 'import { buildInstantPublishCdnPlan } from "./publish-cdn-plan.ts";' in text
        assert 'createEmptyQueuedCdnState,' in text
        assert 'hydrateQueuedCdnState,' in text
        assert 'markQueuedCdnStateRunning,' in text
        assert 'from "./queued-cdn-state.ts";' in text
        assert 'const [allPendingFiles, setAllPendingFiles] = useState([]);' in text
        assert 'const [queuedCdnState, setQueuedCdnState] = useState(createEmptyQueuedCdnState());' in text
        assert 'setAllPendingFiles(data.files || []);' in text
        assert 'const instantCdnPlan = buildInstantPublishCdnPlan({' in text
        assert 'pendingFiles: allPendingFiles,' in text
        assert 'fetch(`${API_BASE}/api/cdn/queue`)' in text
        assert 'endpoint.endsWith("/api/cdn/publish/live")' in text
        assert 'const rememberedPublishPlan = endpoint.endsWith("/api/cdn/publish/live")' in text
        assert '// WHY: Backend persists the CDN queue plan to disk before emitting' in text
        assert 'refreshCdnQueue();' in text
        assert 'queuedCdnState.paths.length' in text
        assert 'const hasQueuedCdnLog = queuedCdnState.logLines.length > 0;' in text
        assert 'const publishQueueCdnLogLines = hasLiveCdnRun ? cdnPaths : queuedCdnDisplayPaths;' in text
        assert 'const publishQueueCdnLogState = hasLiveCdnRun ? "LIVE" : queuedCdnState.status;' in text
        assert 'const [queuedCdnDetailOpen, setQueuedCdnDetailOpen] = useState(false);' in text
        assert 'CDN Queue Details' in text
        assert 'queuedCdnState.entries.map((entry)' in text
        assert 'CDN Publish' in controls_source
        assert 'queued paths' in controls_source
        assert 'startSiteOperation(`${API_BASE}/api/cdn/publish/live`, "cdn", "cdntab", "CDN publish error"' in text
        assert 'setQueuedCdnState(createEmptyQueuedCdnState());' in text

    def test_dashboard_source_uses_root_script_relative_path_for_cdn_helpers(self):
        text = _dashboard_source_text()
        publish_plan_text = (UI_DIR / "publish-cdn-plan.ts").read_text(encoding="utf-8")

        # dashboard.jsx uses a pre-computed browser-safe module for the constant
        assert 'from "./invalidation-paths.js";' in text
        # publish-cdn-plan.ts still imports functions from the Node.js module
        assert 'from "../../../scripts/invalidation-core.mjs";' in publish_plan_text
        assert 'from "../../scripts/invalidation-core.mjs";' not in text
        assert 'from "../../scripts/invalidation-core.mjs";' not in publish_plan_text

    def test_dashboard_source_declares_refresh_callbacks_before_consume_sse_stream(self):
        text = _dashboard_source_text()

        assert text.index('const refreshCdnQueue = useCallback(() => {') < text.index('const consumeSSEStream = useCallback((endpoint, failurePrefix, requestOptions = {}) => {')
        assert text.index('const refreshSidebarInsights = useCallback(() => {') < text.index('const consumeSSEStream = useCallback((endpoint, failurePrefix, requestOptions = {}) => {')
        assert text.index('const refreshStatus = useCallback((fullFileList = false) => {') < text.index('const consumeSSEStream = useCallback((endpoint, failurePrefix, requestOptions = {}) => {')

    def test_dashboard_source_queues_all_split_s3_actions_into_cdn_publish_queue(self):
        text = _dashboard_source_text()

        assert 'activeSiteOperationProfileRef.current === "s3-data-rebuild"' in text
        assert 'activeSiteOperationProfileRef.current === "s3-image-rebuild"' in text
        assert 'nextSiteOperationProfile === "s3-data-rebuild"' in text
        assert 'nextSiteOperationProfile === "s3-image-rebuild"' in text
        assert 'activeSplitPublishPlanRef.current = nextSiteOperationProfile === "s3-data-publish"' in text
        assert '|| nextSiteOperationProfile === "s3-data-rebuild"' in text
        assert '|| nextSiteOperationProfile === "s3-image-rebuild"' in text
        assert 'refreshCdnQueue();' in text

    def test_dashboard_source_replaces_placeholder_database_connectors_with_live_infra_panel(self):
        text = _dashboard_source_text()
        assert 'fetch(`${API_BASE}/api/infra/status`)' in text
        assert 'const [infraResources, setInfraResources] = useState([]);' in text
        assert 'const [infraHealthChecks, setInfraHealthChecks] = useState([]);' in text
        assert 'const [lambdaFolderLinks, setLambdaFolderLinks] = useState([]);' in text
        assert 'const [infraLoading, setInfraLoading] = useState(true);' in text
        assert 'const [infraError, setInfraError] = useState(null);' in text
        assert 'Panel title="Infra Dependencies"' in text
        assert "Database Connectors" not in text
        for placeholder in ["aggrer", "suite", "dlaN", "eggeer-tzs-cr", "eggeer-tae-sor", "eg-tac-prod-2", "HEALTH PING (PROD)", "P0", "P9"]:
            assert placeholder not in text

    def test_dashboard_source_shows_visible_lambda_packaging_progress_metric(self):
        text = _dashboard_source_text()
        assert 'Packaging Progress' in text
        assert 'lambdaPackagePct' in text
        assert '[lambda] package ' in text

    def test_dashboard_source_moves_lambda_completion_status_into_tiles(self):
        text = _dashboard_source_text()
        assert 'Lambda deployment complete | {elapsed.toFixed(1)}s total' not in text
        assert 'const lambdaTileDoneValue = (key) => {' in text
        assert '"Ready"' in text
        assert 'return "Done";' in text

    def test_dashboard_source_uses_lambda_files_from_status_and_marks_all_tiles_done(self):
        text = _dashboard_source_text()
        assert 'setLambdaFiles(data.lambdaFiles || (data.files || []).filter' in text
        assert 'if(phase==="done") return "done";' in text

    def test_dashboard_source_contains_professional_lambda_tooltips(self):
        text = _dashboard_source_text()
        assert 'function TooltipAnchor({' in text
        assert 'Shown in AWS Lambda console as Function name.' in text
        assert 'Shown in AWS Lambda configuration as Runtime.' in text
        assert 'Shown in AWS Lambda configuration as Memory.' in text
        assert 'Shown in AWS Lambda configuration as Timeout.' in text
        assert 'Full AWS resource identifier used in IAM policies' in text
        assert 'This is a dashboard status, not an AWS Lambda console state.' in text

    def test_dashboard_source_tracks_real_lambda_stage_progress_per_tile(self):
        text = _dashboard_source_text()
        assert 'const [lambdaStagePct, setLambdaStagePct] = useState({' in text
        assert 'line.match(/^\\[lambda\\] stage ([a-z-]+) (\\d+)%(?:\\s+(.*))?$/)' in text
        assert 'setLambdaStagePct(prev => ({ ...prev, [stageKey]: pctValue }));' in text
        assert 'if (lane === "lambda" && lambdaStagePct[key] > 0) {' in text
        assert 'return lambdaStagePct[key];' in text

    def test_dashboard_source_fetches_live_lambda_cards_and_removes_static_placeholders(self):
        text = _dashboard_source_text()
        assert 'fetch(`${API_BASE}/api/lambda/functions`)' in text
        assert 'const [lambdaCards, setLambdaCards] = useState([]);' in text
        assert 'const [lambdaCatalogError, setLambdaCatalogError] = useState(null);' in text
        assert 'const LAMBDAS = [' not in text
        assert 'No live Lambda metadata available.' in text
        assert 'fn.purpose' in text

    def test_dashboard_source_uses_live_page_inventory_and_derived_category_summaries(self):
        text = _dashboard_source_text()
        assert 'const [matrixRows, setMatrix]   = useState([]);' in text
        assert 'const [siteStagePct, setSiteStagePct] = useState({' in text
        assert 'const SITE_STAGE_KEY_MAP = {' in text
        assert 'const _CATEGORY_META = {' in text
        assert 'const pageCategorySummaries = useMemo(() => {' in text
        assert 'const totalPages = matrixRows.filter(r=>r.status==="success").length;' in text
        assert 'payload.kind === "page_inventory"' in text
        assert 'payload.kind === "site_stage_progress"' in text
        assert 'setMatrix(payload.rows || []);' in text
        assert 'setSiteStagePct(prev => applySiteStageProgressEvent(prev, {' in text
        assert 'progress: payload.progress || 0,' in text
        assert 'stage: payload.stage,' in text
        assert 'setTerm(prev => [...prev, { text: `[${payload.stage}] ${payload.progress || 0}% ${payload.detail || ""}`.trim(), kind: "info", id: Math.random() }]);' in text
        assert 'applyBuildProgressToMatrix(payload.progress || 0);' not in text
        assert 'const applyBuildProgressToMatrix = useCallback((progress) => {' not in text
        assert 'const routeMatch = line.match(/\\/[^\\s]*?\\.html\\b/);' in text
        assert 'function getMatrixCategoryFromRoutePath(routePath) {' in text
        assert 'const parts = `${routePath}`.split("/").filter(Boolean);' in text
        assert 'function upsertMatrixRowForRoute(rows, routePath, status) {' in text
        assert 'const existingRow = rows.find(row => row.path === routePath);' in text
        assert 'return [...rows, nextRow];' in text
        assert 'setMatrix(prev => upsertMatrixRowForRoute(prev, routePath, kind === "delete" ? "failed" : "success"));' in text
        assert 'const siteProgressKey = lane === "site" ? SITE_STAGE_KEY_MAP[key] || key : key;' in text
        assert 'if (lane === "site" && displaySiteStagePct[siteProgressKey] > 0)' in text
        assert 'pageCategorySummaries.map(c=>(' in text
        assert 'const MATRIX_PAGES = [' not in text
        assert 'const [cats, setCats]       = useState(CATS.map(c=>({...c})));' not in text
        assert 'cats.reduce' not in text
        assert 'const [animPct, setAnimPct] = useState(row.pct);' not in text
        assert 'if(live){ const id=setInterval(()=>setAnimPct(p=>Math.min(p+1,99)),350); return ()=>clearInterval(id); }' not in text
        assert 'const displayPct = isRunning && row.status === "building" ? Math.max(row.pct, 1) : row.pct;' in text

    def test_dashboard_source_passes_category_meta_into_matrix_rows(self):
        text = _dashboard_source_text()
        matrix_tab_source = text.split('{/* MATRIX TAB */}', 1)[1].split('{/* CATEGORIES TAB */}', 1)[0]

        assert 'function MatrixRow({ row, isRunning, categoryMeta }) {' in text
        assert 'const catColor = (categoryMeta[row.cat] || {}).color || T.dim;' in text
        assert '<MatrixRow key={r.id} row={r} isRunning={isSiteMode && isRunning} categoryMeta={CATEGORY_META}/>' in matrix_tab_source

    def test_dashboard_source_smooths_site_pipeline_progress_without_inventing_page_row_work(self):
        text = _dashboard_source_text()
        assert 'import {' in text
        assert 'applySiteStageProgressEvent,' in text
        assert 'createEmptySiteStageProgress,' in text
        assert 'const [displaySiteStagePct, setDisplaySiteStagePct] = useState(createEmptySiteStageProgress);' in text
        assert 'const [siteStageLinePct, setSiteStageLinePct] = useState(createEmptySiteStageProgress);' in text
        assert 'setDisplaySiteStagePct(createEmptySiteStageProgress());' in text
        assert 'setSiteStageLinePct(createEmptySiteStageProgress());' in text
        assert 'const siteStagePctRef = useRef(createEmptySiteStageProgress());' in text
        assert 'const nextBuildLineDisplayCap = (progress) => {' in text
        assert 'build: ["syncing", "cdn", "done"].includes(phase) ? 100 : Math.max(siteStagePct.build, siteStageLinePct.build),' in text
        assert 'const siteStageDisplayTarget = {' in text
        assert 'sync: ["cdn", "done"].includes(phase) ? 100 : siteStagePct.sync,' in text
        assert 'cdn: phase === "done" ? 100 : siteStagePct.cdn,' in text
        assert 'siteStagePctRef.current = siteStagePct;' in text
        assert 'setSiteStageLinePct(prev => ({ ...prev, [payload.stage]: Math.max(prev[payload.stage], payload.progress || 0) }));' in text
        assert 'const cappedTarget = nextBuildLineDisplayCap(siteStagePctRef.current.build);' in text
        assert 'if (lane === "site" && displaySiteStagePct[siteProgressKey] > 0) {' in text

    def test_dashboard_source_uses_live_site_stage_detail_in_pipeline_cards(self):
        text = _dashboard_source_text()
        assert 'const siteStageDetailKey = SITE_STAGE_KEY_MAP[s.key];' in text
        assert 'const liveStageDetail = siteStageDetailKey ? siteStageDetail[siteStageDetailKey] : "";' in text
        assert 'const dynamicSub = st==="active" && liveStageDetail ? liveStageDetail : s.sub;' in text
        assert '{dynamicSub}' in text
        assert 'return displaySiteStagePct[siteProgressKey];' in text
        assert 'displaySiteStagePct[{ building:"build", syncing:"sync", cdn:"cdn" }[phase]] > 0' in text
        assert 'setDisplaySiteStagePct(prev => {' in text
        assert 'Finalizing...' not in text

    def test_dashboard_source_explains_pre_route_matrix_wait_state(self):
        text = _dashboard_source_text()
        assert 'const showMatrixPreRouteNotice = isSiteMode' in text
        assert 'matrixRows.every(row => row.status === "queued")' in text
        assert 'Astro is preparing static entrypoints.' in text
        assert 'Page rows will begin once route generation starts.' in text
        assert 'showMatrixPreRouteNotice && (' in text

    def test_dashboard_source_explains_that_cached_publish_modes_do_not_have_live_page_matrix_rows(self):
        text = _dashboard_source_text()
        assert 'siteOperationProfile === "quick-publish"' in text
        assert 'siteOperationProfile === "astro-publish"' in text
        assert 'siteOperationProfile === "s3-data-publish"' in text
        assert 'siteOperationProfile === "s3-image-publish"' in text
        assert 'Cached publish does not expose per-page route rows.' in text
        assert 'Use Force Full Rebuild or Astro Rebuild for live page inventory.' in text

    @pytest.mark.anyio
    async def test_bundle_contains_pre_route_matrix_storytelling_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "Astro is preparing static entrypoints." in r.text
        assert "Page rows will begin once route generation starts." in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_cached_publish_matrix_empty_state_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "Cached publish does not expose per-page route rows." in r.text
        assert "Use Force Full Rebuild or Astro Rebuild for live page inventory." in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_publish_queue_panel_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "Publish Queue" in r.text
        assert "CDN Queue Log" in r.text
        assert "upload ready" in r.text

    @pytest.mark.anyio
    async def test_bundle_keeps_simulate_changes_button_and_drops_touch_mtimes_chip_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "SIMULATE CHANGES" in r.text
        assert "Touch mtimes only" not in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_cache_purge_confirmation_warning_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "Purge the local Astro/Vite caches before the next publish?" in r.text
        assert "The next Astro publish will rebuild from a cold cache." in r.text
        assert "It resets the site, data, and image pending markers so the next publish starts cold." in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_s3_sync_four_way_subtab_labels(self, client):
        r = await client.get("/app.bundle.js")
        for label in ["DATA UPLOAD", "IMAGES UPLOAD", "DATA DELETE", "IMAGES DELETE"]:
            assert label in r.text

    @pytest.mark.anyio
    async def test_bundle_drops_s3_panel_placeholder_copy(self, client):
        r = await client.get("/app.bundle.js")
        assert "Preview Delta" in r.text
        assert "Observed Ops" in r.text
        for placeholder in ["QuickCDN Mem", "eggeer-tac", "eg-tac-prod-operations"]:
            assert placeholder not in r.text

    @pytest.mark.anyio
    async def test_bundle_contains_real_cdn_metric_labels_and_no_hardcoded_footer(self, client):
        r = await client.get("/app.bundle.js")
        for label in ["Planned Paths", "Groups", "Invalidations", "Polling", "Last Error"]:
            assert label in r.text
        for placeholder in ["Distribution: ", "E1ITXKZVMDZMZ5"]:
            assert placeholder not in r.text

    def test_dashboard_source_adds_panel_loading_spinner_and_watcher_label(self):
        text = _dashboard_source_text()
        assert 'function Panel({ title, icon, children, accent, style: sx, loading, headerRight }) {' in text
        assert 'const PANEL_LOADING_META = {' in text
        assert 'function PanelLoadingOverlay({ title, accent }) {' in text
        assert 'const [statusLoading, setStatusLoading] = useState(true);' in text
        assert 'const [lambdaCatalogLoading, setLambdaCatalogLoading] = useState(true);' in text
        assert 'const isPanelLoading = statusLoading || lambdaCatalogLoading;' in text
        assert 'loading && (' in text
        assert '>WATCHER</div>' in text
        assert 'Preparing metrics feed' in text
        assert 'Resolving Lambda inventory' in text
        assert 'Reviewing watched paths and pending Lambda changes' in text
        assert '<svg viewBox="0 0 64 64"' in text
        assert 'position:"absolute",inset:0' in text

    def test_dashboard_source_streams_manual_cdn_invalidations_and_resets_the_cdn_panel(self):
        text = _dashboard_source_text()
        assert 'setSyncFiles([]); setCdnPaths([]);' in text
        assert 'const startSiteOperation = useCallback((endpoint, initialPhase, tab = "terminal", failurePrefix = "Connection error") => {' in text
        assert 'setRunMode("site");' in text
        assert 'setPhase("cdn");' in text
        assert 'setActiveTab(tab);' in text
        assert 'startSiteOperation(`${API_BASE}/api/cdn/invalidate/live`, "cdn", "cdntab", "CDN invalidation error");' in text
        assert 'fetch(`${API_BASE}/api/cdn/invalidate`, { method: "POST" })' not in text
        assert 'Creating CDN invalidation for /*...' not in text

