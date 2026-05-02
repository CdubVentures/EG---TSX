from __future__ import annotations

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


def test_deploy_history_service_returns_recent_runs_newest_first():
    from services.deploy_history import clear_deploy_history, get_recent_runs, record_deploy_run

    clear_deploy_history()
    record_deploy_run(
        kind="site",
        label="Quick",
        status="success",
        started_at="2026-03-08T00:00:00+00:00",
        completed_at="2026-03-08T00:00:22+00:00",
        duration_seconds=22.1,
        pages_built=366,
        uploaded=48,
        deleted=3,
        cdn_paths=6,
        lambda_version=None,
    )
    record_deploy_run(
        kind="lambda",
        label="Lambda",
        status="failed",
        started_at="2026-03-08T00:01:00+00:00",
        completed_at="2026-03-08T00:01:12+00:00",
        duration_seconds=12.4,
        pages_built=0,
        uploaded=0,
        deleted=0,
        cdn_paths=0,
        lambda_version=52,
    )

    runs = get_recent_runs()

    assert len(runs) == 2
    assert runs[0]["label"] == "Lambda"
    assert runs[0]["status"] == "failed"
    assert runs[0]["lambdaVersion"] == 52
    assert runs[1]["label"] == "Quick"
    assert runs[1]["pagesBuilt"] == 366


def test_system_health_service_reads_real_cache_and_disk_metrics(tmp_path):
    from services.system_health import read_system_health

    config = _make_config(tmp_path)
    (config.astro_cache_dir / "chunks").mkdir(parents=True, exist_ok=True)
    (config.astro_cache_dir / "chunks" / "a.bin").write_bytes(b"a" * 1024 * 1024)
    (config.vite_cache_dir / "deps").mkdir(parents=True, exist_ok=True)
    (config.vite_cache_dir / "deps" / "b.bin").write_bytes(b"b" * 512 * 1024)

    with patch("services.system_health.read_cpu_percent", return_value=17.0), \
         patch("services.system_health.read_memory_snapshot_gb", return_value=(3.8, 15.9)), \
         patch("services.system_health.read_disk_free_gb", return_value=(124.0, 256.0)):
        payload = read_system_health(config)

    assert "collectedAt" in payload
    assert len(payload["metrics"]) == 4
    metric_map = {metric["key"]: metric for metric in payload["metrics"]}
    assert metric_map["cpu"]["value"] == 17.0
    assert metric_map["memory"]["value"] == 3.8
    assert metric_map["memory"]["max"] == 15.9
    assert metric_map["build-cache"]["value"] >= 1.4
    assert metric_map["disk-free"]["value"] == 124.0


def test_read_cpu_percent_uses_native_system_times_without_shelling_out():
    from services import system_health

    with patch("services.system_health._cpu_times_snapshot", side_effect=[
        (100, 300, 200),
        (160, 420, 320),
    ]), \
         patch("services.system_health.subprocess.run") as subprocess_run:
        system_health._LAST_CPU_TIMES = None
        first = system_health.read_cpu_percent()
        second = system_health.read_cpu_percent()

    assert first == 0.0
    assert second == 75.0
    subprocess_run.assert_not_called()


def test_history_endpoint_returns_session_run_data(tmp_path):
    from main import app
    from services.deploy_history import clear_deploy_history, record_deploy_run

    config = _make_config(tmp_path)
    clear_deploy_history()
    record_deploy_run(
        kind="site",
        label="Full",
        status="success",
        started_at="2026-03-08T00:00:00+00:00",
        completed_at="2026-03-08T00:00:51+00:00",
        duration_seconds=51.3,
        pages_built=364,
        uploaded=71,
        deleted=8,
        cdn_paths=12,
        lambda_version=None,
    )

    with patch("main.config", config):
        client = TestClient(app)
        response = client.get("/api/deploy/history")

    assert response.status_code == 200
    data = response.json()
    assert len(data["runs"]) == 1
    assert data["runs"][0]["label"] == "Full"
    assert data["runs"][0]["durationSeconds"] == 51.3
    assert data["runs"][0]["uploaded"] == 71


def test_cdn_queue_service_persists_entries_across_reload(tmp_path):
    from services.cdn_queue import (
        append_cdn_queue_plan,
        clear_cdn_queue,
        get_cdn_queue_state,
        reload_cdn_queue_from_disk,
    )

    queue_file = tmp_path / "cdn_queue.json"

    with patch("services.cdn_queue._QUEUE_FILE", queue_file):
        clear_cdn_queue()
        append_cdn_queue_plan(
            label="S3 Data Publish",
            plan={
                "mode": "SMART",
                "paths": ["/guides/*", "/_astro/*"],
                "reason": "Built CDN-facing routes from the static sync diff.",
                "sourceProfile": "s3-data-publish",
            },
        )
        reload_cdn_queue_from_disk()
        queue_state = get_cdn_queue_state()

    assert queue_state["status"] == "QUEUED"
    assert queue_state["mode"] == "SMART"
    assert queue_state["paths"] == ["/guides/*", "/_astro/*"]
    assert queue_state["entries"][0]["label"] == "S3 Data Publish"
    assert queue_state["entries"][0]["status"] == "QUEUED"


def test_cdn_queue_endpoint_returns_persisted_queue_state(tmp_path):
    from main import app
    from services.cdn_queue import append_cdn_queue_plan, clear_cdn_queue

    config = _make_config(tmp_path)
    queue_file = tmp_path / "cdn_queue.json"

    with patch("services.cdn_queue._QUEUE_FILE", queue_file):
        clear_cdn_queue()
        append_cdn_queue_plan(
            label="S3 Image Publish",
            plan={
                "mode": "SMART",
                "paths": ["/news/mouse/*"],
                "reason": "Mapped changed image keys to owning page invalidation patterns.",
                "sourceProfile": "s3-image-publish",
            },
        )

        with patch("main.config", config):
            client = TestClient(app)
            response = client.get("/api/cdn/queue")

    assert response.status_code == 200
    data = response.json()
    assert data["queue"]["status"] == "QUEUED"
    assert data["queue"]["entries"][0]["label"] == "S3 Image Publish"
    assert data["queue"]["entries"][0]["paths"] == ["/news/mouse/*"]
    assert data["queue"]["logLines"] == ["[queue] S3 Image Publish queued 1 CDN path(s)"]


def test_system_health_endpoint_returns_live_metric_payload(tmp_path):
    from main import app

    config = _make_config(tmp_path)

    with patch("main.config", config), \
         patch(
             "routers.system_health.read_system_health",
             return_value={
                 "collectedAt": "2026-03-08T00:00:00+00:00",
                 "metrics": [
                     {"key": "cpu", "label": "CPU", "value": 18.0, "max": 100.0, "unit": "%", "status": "healthy", "detail": "System CPU usage"},
                     {"key": "memory", "label": "Memory", "value": 3.8, "max": 15.9, "unit": "GB", "status": "healthy", "detail": "3.8 / 15.9 GB used"},
                 ],
             },
         ):
        client = TestClient(app)
        response = client.get("/api/system/health")

    assert response.status_code == 200
    data = response.json()
    assert data["metrics"][0]["key"] == "cpu"
    assert data["metrics"][1]["detail"] == "3.8 / 15.9 GB used"
