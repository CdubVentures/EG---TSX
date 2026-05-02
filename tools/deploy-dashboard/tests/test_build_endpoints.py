"""
Phase 5 tests -- build endpoints (quick/full) with mocked subprocess.
"""

import asyncio
import json
import os
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from config import AppConfig
from services.runner import SSELine, CommandStep
from services.watcher import ChangedFile, WatcherStatus


def _make_config(tmp_path: Path) -> AppConfig:
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
    """Parse SSE text into list of JSON dicts."""
    events = []
    for chunk in response_text.split("\n\n"):
        chunk = chunk.strip()
        if chunk.startswith("data: "):
            events.append(json.loads(chunk[6:]))
    return events


def _watcher_status(
    *,
    pending: bool,
    count: int = 1,
    has_pending_uploads: bool = False,
    pending_upload_count: int = 0,
    has_pending_data_uploads: bool = False,
    pending_data_upload_count: int = 0,
    has_pending_image_uploads: bool = False,
    pending_image_upload_count: int = 0,
) -> WatcherStatus:
    return WatcherStatus(
        pending=pending,
        count=count,
        last_sync_at="2026-03-08T00:00:00+00:00",
        files=[],
        lambda_files=[],
        has_product_changes=False,
        has_lambda_changes=False,
        last_build_at="2026-03-08T00:00:00+00:00",
        last_data_sync_at="2026-03-08T00:00:00+00:00",
        last_image_sync_at="2026-03-08T00:00:00+00:00",
        has_pending_uploads=has_pending_uploads,
        pending_upload_count=pending_upload_count,
        has_pending_data_uploads=has_pending_data_uploads,
        pending_data_upload_count=pending_data_upload_count,
        has_pending_image_uploads=has_pending_image_uploads,
        pending_image_upload_count=pending_image_upload_count,
    )


async def _mock_stream_success(steps, on_complete=None):
    """Mock stream_commands that yields one line per step, then calls on_complete."""
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
    """Mock stream_commands that yields one line then raises."""
    import subprocess
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


async def _mock_lambda_stream(_config):
    """Mock the real lambda deploy stream with four operator stages."""
    for stage, line in [
        ("lambda-package", "Starting: Packaging Lambda Artifact"),
        ("lambda-upload", "Starting: Uploading Lambda Artifact"),
        ("lambda-deploy", "Starting: Deploying CloudFormation Stack"),
        ("lambda-live", "Starting: Refreshing Stack Outputs"),
    ]:
        yield SSELine(
            stage=stage,
            source="system",
            line=line,
            timestamp="2026-03-07T15:00:00Z",
        )


async def _mock_lambda_stream_failure(_config):
    yield SSELine(
        stage="lambda-package",
        source="system",
        line="FAILED with exit code 1",
        timestamp="2026-03-07T15:00:00Z",
    )
    raise subprocess.CalledProcessError(1, ["node", "scripts/deploy-aws.mjs"])


class _ImmediateThread:
    def __init__(self, target=None, args=(), daemon=None):
        self._target = target
        self._args = args

    def start(self):
        if self._target:
            self._target(*self._args)


class _DummyPipe:
    def close(self):
        return None


class _FakeProc:
    def __init__(self):
        self.stdout = _DummyPipe()
        self.stderr = _DummyPipe()

    def wait(self):
        return 0


def _changed_file(path: str, *, file_type: str = "MODIFIED", category: str = "guide") -> ChangedFile:
    return ChangedFile(
        path=path,
        file_type=file_type,
        category=category,
        mtime="2026-03-08T00:00:00+00:00",
    )


# -- Step composition tests ----------------------------------------------------


def test_quick_build_steps_correct(tmp_path):
    from routers.build import build_quick_steps

    cfg = _make_config(tmp_path)
    steps = build_quick_steps(cfg)

    assert len(steps) == 3
    assert steps[0].stage == "build"
    assert steps[1].stage == "sync"
    assert steps[2].stage == "cdn"


def test_full_build_steps_correct(tmp_path):
    from routers.build import build_full_steps

    cfg = _make_config(tmp_path)
    steps = build_full_steps(cfg)

    assert len(steps) == 3
    assert steps[0].stage == "build"
    assert steps[1].stage == "sync"
    assert steps[2].stage == "cdn"


def test_quick_build_s3_args(tmp_path):
    from routers.build import build_quick_steps

    cfg = _make_config(tmp_path)
    steps = build_quick_steps(cfg)
    sync_step = steps[1]

    assert "--delete" in sync_step.args
    assert f"s3://{cfg.s3_bucket}/" in sync_step.args
    assert cfg.aws_region in sync_step.args
    # Excludes present
    assert "*/orginanls/*" in sync_step.args
    assert "*/originals/*" in sync_step.args


def test_full_build_s3_args(tmp_path):
    from routers.build import build_full_steps

    cfg = _make_config(tmp_path)
    steps = build_full_steps(cfg)
    sync_step = steps[1]

    assert "--delete" in sync_step.args
    assert f"s3://{cfg.s3_bucket}/" in sync_step.args


def test_dry_run_adds_dryrun_flag(tmp_path):
    from routers.build import build_quick_steps

    cfg = _make_config(tmp_path)
    steps = build_quick_steps(cfg, dry_run=True)
    sync_step = steps[1]

    assert "--dryrun" in sync_step.args


def test_build_site_deploy_args_quick(tmp_path):
    from routers.build import build_site_deploy_args

    cfg = _make_config(tmp_path)
    assert build_site_deploy_args(cfg, "quick") == [
        "node",
        "scripts/deploy-aws.mjs",
        "--skip-stack",
        "--static-scope",
        "site",
        "--sync-mode",
        "quick",
        "--invalidation-mode",
        "smart",
    ]


def test_build_site_deploy_args_use_configured_script_path(tmp_path):
    from routers.build import build_site_deploy_args

    cfg = SimpleNamespace(
        project_root=tmp_path,
        deploy_script_path=tmp_path / "ops" / "deploy-portable.mjs",
    )

    assert build_site_deploy_args(cfg, "quick")[1] == "ops/deploy-portable.mjs"


def test_build_site_deploy_args_quick_sync_only(tmp_path):
    from routers.build import build_site_deploy_args

    cfg = _make_config(tmp_path)
    assert build_site_deploy_args(cfg, "quick-sync-only") == [
        "node",
        "scripts/deploy-aws.mjs",
        "--skip-build",
        "--skip-stack",
        "--static-scope",
        "site",
        "--sync-mode",
        "quick",
        "--invalidation-mode",
        "smart",
    ]


def test_build_site_deploy_args_full(tmp_path):
    from routers.build import build_site_deploy_args

    cfg = _make_config(tmp_path)
    assert build_site_deploy_args(cfg, "full") == [
        "node",
        "scripts/deploy-aws.mjs",
        "--skip-stack",
        "--static-scope",
        "site",
        "--sync-mode",
        "full",
        "--invalidation-mode",
        "full",
    ]


@pytest.mark.parametrize(
    ("mode", "expected_args"),
    [
        (
            "astro-publish",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-stack",
                "--skip-static",
                "--skip-invalidate",
                "--sync-mode",
                "quick",
            ],
        ),
        (
            "astro-rebuild",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-stack",
                "--skip-static",
                "--skip-invalidate",
            ],
        ),
        (
            "s3-data-rebuild",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-build",
                "--skip-stack",
                "--skip-invalidate",
                "--static-scope",
                "data",
                "--sync-mode",
                "full",
            ],
        ),
        (
            "s3-image-rebuild",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-build",
                "--skip-stack",
                "--skip-invalidate",
                "--static-scope",
                "images",
                "--sync-mode",
                "full",
            ],
        ),
        (
            "s3-data-publish",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-build",
                "--skip-stack",
                "--skip-invalidate",
                "--static-scope",
                "data",
                "--sync-mode",
                "quick",
            ],
        ),
        (
            "s3-image-publish",
            [
                "node",
                "scripts/deploy-aws.mjs",
                "--skip-build",
                "--skip-stack",
                "--skip-invalidate",
                "--static-scope",
                "images",
                "--sync-mode",
                "quick",
            ],
        ),
    ],
)
def test_build_site_deploy_args_split_modes(tmp_path, mode, expected_args):
    from routers.build import build_site_deploy_args

    cfg = _make_config(tmp_path)
    assert build_site_deploy_args(cfg, mode) == expected_args


def test_collect_page_inventory_from_dist_client(tmp_path):
    from routers.build import collect_page_inventory

    cfg = _make_config(tmp_path)
    (cfg.dist_client_dir / "news" / "best-mice").mkdir(parents=True, exist_ok=True)
    (cfg.dist_client_dir / "mice" / "razer-viper").mkdir(parents=True, exist_ok=True)
    (cfg.dist_client_dir / "news" / "best-mice" / "index.html").write_text("ok", encoding="utf-8")
    (cfg.dist_client_dir / "mice" / "razer-viper" / "index.html").write_text("ok", encoding="utf-8")
    (cfg.dist_client_dir / "robots.txt").write_text("ignore", encoding="utf-8")

    assert collect_page_inventory(cfg) == [
        {
            "cat": "mice",
            "changed": False,
            "elapsed": "--",
            "id": "/mice/razer-viper/index.html",
            "path": "/mice/razer-viper/index.html",
            "pct": 0,
            "status": "queued",
        },
        {
            "cat": "news",
            "changed": False,
            "elapsed": "--",
            "id": "/news/best-mice/index.html",
            "path": "/news/best-mice/index.html",
            "pct": 0,
            "status": "queued",
        },
    ]


def test_parse_deploy_event_maps_site_stage_progress():
    from routers.build import _parse_deploy_event

    assert _parse_deploy_event(json.dumps({
        "detail": "Generating static routes",
        "egTsxEvent": True,
        "kind": "site_stage_progress",
        "progress": 42,
        "stage": "build",
    })) == {
        "detail": "Generating static routes",
        "kind": "site_stage_progress",
        "progress": 42,
        "stage": "build",
    }


def test_parse_deploy_event_maps_route_graph_warning():
    from routers.build import _parse_deploy_event

    payload = {
        "egTsxEvent": True,
        "kind": "route_graph_warning",
        "status": "warning",
        "mode": "astro-rebuild",
        "issueCount": 17,
        "logFile": "debug/deploy/2026-03-09_21-14-08_route-graph-warning.txt",
        "logText": "EG-TSX Route Graph Warning Report\nTimestamp: 2026-03-09 21:14:08\n...",
        "summary": {
            "unresolvedLinks": 6,
            "orphanPages": 4,
            "canonicalMismatches": 2,
            "sitemapMismatches": 3,
            "noindexLeaks": 2,
            "duplicateCanonicals": 0,
        },
    }

    result = _parse_deploy_event(json.dumps(payload))

    assert result is not None
    assert result["kind"] == "route_graph_warning"
    assert result["status"] == "warning"
    assert result["mode"] == "astro-rebuild"
    assert result["issueCount"] == 17
    assert result["summary"]["orphanPages"] == 4
    assert result["logFile"] == "debug/deploy/2026-03-09_21-14-08_route-graph-warning.txt"
    assert result["logText"] == "EG-TSX Route Graph Warning Report\nTimestamp: 2026-03-09 21:14:08\n..."


def test_stream_site_build_yields_route_graph_warning_line(tmp_path):
    from routers.build import stream_site_build, RouteGraphWarningLine

    cfg = _make_config(tmp_path)
    warning_event = json.dumps({
        "egTsxEvent": True,
        "kind": "route_graph_warning",
        "status": "warning",
        "mode": "quick",
        "issueCount": 3,
        "logFile": "debug/deploy/2026-03-09_21-14-08_route-graph-warning.txt",
        "summary": {"unresolvedLinks": 1, "orphanPages": 2},
    })

    def _fake_read_stream(_stream, event_queue, source_tag):
        if source_tag == "stdout":
            event_queue.put((source_tag, warning_event))
        event_queue.put((source_tag, None))

    with patch("routers.build.subprocess.Popen", return_value=_FakeProc()), \
         patch("routers.build.threading.Thread", side_effect=lambda target=None, args=(), daemon=None: _ImmediateThread(target, args, daemon)), \
         patch("routers.build._read_stream", side_effect=_fake_read_stream):
        async def _collect():
            return [event async for event in stream_site_build(cfg, "quick")]

        events = asyncio.run(_collect())

    warning_events = [e for e in events if isinstance(e, RouteGraphWarningLine)]
    assert len(warning_events) == 1
    assert warning_events[0].kind == "route_graph_warning"
    assert json.loads(warning_events[0].warning_json)["issueCount"] == 3


def test_stream_site_build_yields_sse_line_for_site_stage_progress(tmp_path):
    from routers.build import stream_site_build

    cfg = _make_config(tmp_path)
    progress_event = json.dumps({
        "detail": "Preparing Astro build",
        "egTsxEvent": True,
        "kind": "site_stage_progress",
        "progress": 0,
        "stage": "build",
    })

    def _fake_read_stream(_stream, event_queue, source_tag):
        if source_tag == "stdout":
            event_queue.put((source_tag, progress_event))
        event_queue.put((source_tag, None))

    with patch("routers.build.subprocess.Popen", return_value=_FakeProc()), \
         patch("routers.build.threading.Thread", side_effect=lambda target=None, args=(), daemon=None: _ImmediateThread(target, args, daemon)), \
         patch("routers.build._read_stream", side_effect=_fake_read_stream):
        async def _collect():
            return [event async for event in stream_site_build(cfg, "full")]

        events = asyncio.run(_collect())

    assert len(events) == 1
    assert isinstance(events[0], SSELine)
    assert events[0].stage == "build"
    assert events[0].line == "Preparing Astro build"


@pytest.mark.parametrize("mode", ["s3-data-rebuild", "s3-image-rebuild"])
def test_stream_site_build_tags_split_s3_rebuild_lines_as_sync_before_first_stage_event(tmp_path, mode):
    from routers.build import stream_site_build

    cfg = _make_config(tmp_path)
    sync_started_event = json.dumps({
        "egTsxEvent": True,
        "label": "Syncing Static Files",
        "stage": "sync-static",
        "status": "started",
    })

    def _fake_read_stream(_stream, event_queue, source_tag):
        if source_tag == "stdout":
            event_queue.put((source_tag, "Resolving static target"))
            event_queue.put((source_tag, sync_started_event))
        event_queue.put((source_tag, None))

    with patch("routers.build.subprocess.Popen", return_value=_FakeProc()), \
         patch("routers.build.threading.Thread", side_effect=lambda target=None, args=(), daemon=None: _ImmediateThread(target, args, daemon)), \
         patch("routers.build._read_stream", side_effect=_fake_read_stream):
        async def _collect():
            return [event async for event in stream_site_build(cfg, mode)]

        events = asyncio.run(_collect())

    assert events[0].stage == "sync"
    assert events[0].line == "Resolving static target"
    assert events[1].stage == "sync"
    assert events[1].line == "Starting: Syncing Static Files"


def test_full_build_emits_page_inventory_event(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.collect_page_inventory", return_value=[{"id": "/news/test/index.html"}]), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/build/full")

    events = _parse_sse_events(response.text)
    page_inventory_event = next(event for event in events if event.get("kind") == "page_inventory")
    assert page_inventory_event["rows"] == [{"id": "/news/test/index.html"}]


@pytest.mark.parametrize("endpoint", ["/api/build/quick", "/api/build/astro-publish"])
def test_cached_publish_endpoints_do_not_emit_page_inventory_event(tmp_path, endpoint):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.collect_page_inventory", return_value=[{"id": "/news/test/index.html"}]), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post(endpoint)

    events = _parse_sse_events(response.text)
    assert all(event.get("kind") != "page_inventory" for event in events)


@pytest.mark.parametrize(
    ("endpoint", "expected_done_line"),
    [
        ("/api/build/quick", "No pending build or upload changes; quick publish skipped"),
        ("/api/build/astro-publish", "No pending build changes; Astro publish skipped"),
        ("/api/build/s3-data-publish", "No pending data uploads; S3 data publish skipped"),
        ("/api/build/s3-image-publish", "No pending image uploads; S3 image publish skipped"),
    ],
)
def test_cached_publish_endpoints_skip_build_when_watcher_is_clean(tmp_path, endpoint, expected_done_line):
    from main import app

    cfg = _make_config(tmp_path)
    watcher_status = (
        _watcher_status(pending=False, count=0, has_pending_data_uploads=False)
        if endpoint.endswith("/s3-data-publish")
        else _watcher_status(pending=False, count=0, has_pending_image_uploads=False)
        if endpoint.endswith("/s3-image-publish")
        else _watcher_status(pending=False, count=0)
    )

    with patch("routers.build.stream_site_build") as stream_site_build, \
         patch("routers.build.get_pending_changes", return_value=watcher_status), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post(endpoint)

    events = _parse_sse_events(response.text)
    assert events == [{
        "stage": "done",
        "source": "system",
        "line": expected_done_line,
        "timestamp": events[0]["timestamp"],
    }]
    stream_site_build.assert_not_called()
    assert not cfg.sync_marker_path.exists()


def test_quick_build_uses_sync_only_mode_when_only_pending_uploads_remain(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream) as stream_site_build, \
         patch(
             "routers.build.get_pending_changes",
             return_value=_watcher_status(
                 pending=False,
                 count=0,
                 has_pending_uploads=True,
                 pending_upload_count=2,
                 has_pending_data_uploads=True,
                 pending_data_upload_count=1,
                 has_pending_image_uploads=True,
                 pending_image_upload_count=1,
             ),
         ), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/build/quick")

    events = _parse_sse_events(response.text)
    assert events[-1]["line"] == "Quick build complete"
    stream_site_build.assert_called_once_with(cfg, "quick-sync-only")


@pytest.mark.parametrize(
    ("endpoint", "expected_done_line"),
    [
        ("/api/build/astro-publish", "Astro publish complete"),
        ("/api/build/astro-rebuild", "Astro rebuild complete"),
        ("/api/build/s3-data-publish", "S3 data publish complete"),
        ("/api/build/s3-data-rebuild", "S3 data rebuild complete"),
        ("/api/build/s3-image-publish", "S3 image publish complete"),
        ("/api/build/s3-image-rebuild", "S3 image rebuild complete"),
    ],
)
def test_split_build_endpoints_emit_done_event(tmp_path, endpoint, expected_done_line):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post(endpoint)

    events = _parse_sse_events(response.text)
    assert events[-1]["stage"] == "done"
    assert events[-1]["line"] == expected_done_line


def test_split_s3_publishes_accumulate_persisted_cdn_queue_entries(tmp_path):
    from main import app
    from services.cdn_queue import clear_cdn_queue, get_cdn_queue_state

    cfg = _make_config(tmp_path)
    queue_file = tmp_path / "cdn_queue.json"

    data_watcher_status = _watcher_status(
        pending=False,
        has_pending_data_uploads=True,
        pending_data_upload_count=1,
    )
    data_watcher_status.files = [
        _changed_file("src/content/guides/mouse/logitech-g-pro-x-superlight.mdx", category="guide"),
    ]

    image_watcher_status = _watcher_status(
        pending=False,
        has_pending_image_uploads=True,
        pending_image_upload_count=1,
    )
    image_watcher_status.files = [
        _changed_file(
            "public/images/news/mouse/logitech-g-pro-x-superlight/hero.webp",
            category="image",
        ),
    ]

    with patch("services.cdn_queue._QUEUE_FILE", queue_file):
        clear_cdn_queue()
        with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
             patch("routers.build._get_config", return_value=cfg):
            client = TestClient(app)

            with patch("routers.build.get_pending_changes", return_value=data_watcher_status):
                client.post("/api/build/s3-data-publish")

            with patch("routers.build.get_pending_changes", return_value=image_watcher_status):
                client.post("/api/build/s3-image-publish")

        queue_state = get_cdn_queue_state()

    assert queue_state["status"] == "QUEUED"
    assert queue_state["mode"] == "SMART"
    assert len(queue_state["entries"]) == 2
    assert [entry["label"] for entry in queue_state["entries"]] == [
        "S3 Data Publish",
        "S3 Image Publish",
    ]
    assert queue_state["entries"][0]["paths"]
    assert queue_state["entries"][1]["paths"]
    assert queue_state["logLines"] == [
        f"[queue] {entry['label']} queued {len(entry['paths'])} CDN path(s)"
        for entry in queue_state["entries"]
    ]


@pytest.mark.parametrize(
    ("endpoint", "expected_label"),
    [
        ("/api/build/astro-publish", "Astro Publish"),
        ("/api/build/astro-rebuild", "Astro Rebuild"),
        ("/api/build/s3-data-publish", "S3 Data Publish"),
        ("/api/build/s3-data-rebuild", "S3 Data Rebuild"),
        ("/api/build/s3-image-publish", "S3 Image Publish"),
        ("/api/build/s3-image-rebuild", "S3 Image Rebuild"),
    ],
)
def test_successful_split_build_records_history_entry(tmp_path, endpoint, expected_label):
    from main import app
    from services.deploy_history import clear_deploy_history, get_recent_runs

    cfg = _make_config(tmp_path)
    clear_deploy_history()

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.collect_page_inventory", return_value=[{"id": "/news/a/index.html"}]), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post(endpoint)

    runs = get_recent_runs()
    assert runs[0]["label"] == expected_label
    assert runs[0]["status"] == "success"


# -- Endpoint tests (mocked subprocess) ----------------------------------------


def test_sse_content_type():
    from main import app

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)):
        client = TestClient(app)
        response = client.post("/api/build/quick")
        assert "text/event-stream" in response.headers.get("content-type", "")


def test_sse_format_valid():
    from main import app

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)):
        client = TestClient(app)
        response = client.post("/api/build/quick")
        events = _parse_sse_events(response.text)
        assert len(events) >= 1
        for event in events:
            assert "stage" in event
            assert "line" in event


def test_done_event_emitted_on_success():
    from main import app

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)):
        client = TestClient(app)
        response = client.post("/api/build/quick")
        events = _parse_sse_events(response.text)
        stages = [e["stage"] for e in events]
        assert "done" in stages


def test_error_event_emitted_on_failure():
    from main import app

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream_failure), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)):
        client = TestClient(app)
        response = client.post("/api/build/quick")
        events = _parse_sse_events(response.text)
        # Should have an error-like event (FAILED in line)
        failed_events = [e for e in events if "FAILED" in e.get("line", "")]
        assert len(failed_events) >= 1


def test_success_touches_sync_marker(tmp_path):
    from main import app
    from services.watcher import (
        get_build_sync_marker_path,
        get_data_sync_marker_path,
        get_image_sync_marker_path,
    )

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick")
        assert cfg.sync_marker_path.is_file()
        assert get_build_sync_marker_path(cfg).is_file()
        assert get_data_sync_marker_path(cfg).is_file()
        assert get_image_sync_marker_path(cfg).is_file()


def test_successful_astro_publish_touches_build_marker_only(tmp_path):
    from main import app
    from services.watcher import (
        get_build_sync_marker_path,
        get_data_sync_marker_path,
        get_image_sync_marker_path,
    )

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/astro-publish")

    assert get_build_sync_marker_path(cfg).is_file()
    assert not get_data_sync_marker_path(cfg).exists()
    assert not get_image_sync_marker_path(cfg).exists()
    assert not cfg.sync_marker_path.exists()


@pytest.mark.parametrize(
    ("endpoint", "watcher_status", "expected_marker_getter", "other_marker_getter"),
    [
        (
            "/api/build/s3-data-publish",
            _watcher_status(
                pending=False,
                has_pending_data_uploads=True,
                pending_data_upload_count=1,
            ),
            "get_data_sync_marker_path",
            "get_image_sync_marker_path",
        ),
        (
            "/api/build/s3-data-rebuild",
            _watcher_status(pending=False),
            "get_data_sync_marker_path",
            "get_image_sync_marker_path",
        ),
        (
            "/api/build/s3-image-publish",
            _watcher_status(
                pending=False,
                has_pending_image_uploads=True,
                pending_image_upload_count=1,
            ),
            "get_image_sync_marker_path",
            "get_data_sync_marker_path",
        ),
        (
            "/api/build/s3-image-rebuild",
            _watcher_status(pending=False),
            "get_image_sync_marker_path",
            "get_data_sync_marker_path",
        ),
    ],
)
def test_successful_split_s3_operations_touch_only_their_own_upload_markers(
    tmp_path,
    endpoint,
    watcher_status,
    expected_marker_getter,
    other_marker_getter,
):
    from main import app
    import services.watcher as watcher_module

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.get_pending_changes", return_value=watcher_status), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post(endpoint)

    assert getattr(watcher_module, expected_marker_getter)(cfg).is_file()
    assert not getattr(watcher_module, other_marker_getter)(cfg).exists()
    assert not cfg.sync_marker_path.exists()


def test_successful_quick_build_records_history_entry(tmp_path):
    from main import app
    from services.deploy_history import clear_deploy_history, get_recent_runs

    cfg = _make_config(tmp_path)
    clear_deploy_history()

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream), \
         patch("routers.build.collect_page_inventory", return_value=[{"id": "/news/a/index.html"}, {"id": "/guides/b/index.html"}]), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick")

    runs = get_recent_runs()
    assert runs[0]["label"] == "Quick"
    assert runs[0]["status"] == "success"
    assert runs[0]["pagesBuilt"] == 2


def test_failed_build_does_not_touch_marker(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_site_build", side_effect=_mock_site_build_stream_failure), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick")
        assert not cfg.sync_marker_path.exists()


def test_dry_run_does_not_touch_marker(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.build.stream_commands", side_effect=_mock_stream_success), \
         patch("routers.build.get_pending_changes", return_value=_watcher_status(pending=True)), \
         patch("routers.build._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/build/quick?dry_run=true")
        assert not cfg.sync_marker_path.exists()


def test_concurrent_build_returns_409():
    from main import app
    import routers.build as build_module

    # Manually acquire the lock to simulate a running build
    loop = asyncio.new_event_loop()
    loop.run_until_complete(build_module._build_lock.acquire())

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/build/quick")
        assert response.status_code == 409
    finally:
        build_module._build_lock.release()
        loop.close()


def test_lambda_deploy_args_skip_site_pipeline(tmp_path):
    from routers.lambda_deploy import build_lambda_deploy_args

    cfg = _make_config(tmp_path)

    assert build_lambda_deploy_args(cfg) == [
        "node",
        "scripts/deploy-aws.mjs",
        "--skip-build",
        "--skip-static",
        "--skip-invalidate",
    ]


def test_lambda_deploy_args_use_configured_script_path(tmp_path):
    from routers.lambda_deploy import build_lambda_deploy_args

    cfg = SimpleNamespace(
        project_root=tmp_path,
        deploy_script_path=tmp_path / "ops" / "deploy-portable.mjs",
    )

    assert build_lambda_deploy_args(cfg)[1] == "ops/deploy-portable.mjs"


def test_lambda_deploy_popen_kwargs_hide_console_on_windows():
    from routers.lambda_deploy import build_hidden_popen_kwargs

    kwargs = build_hidden_popen_kwargs()

    if os.name == "nt":
      assert kwargs["creationflags"] == subprocess.CREATE_NO_WINDOW
      assert kwargs["startupinfo"] is not None
      assert kwargs["startupinfo"].dwFlags & subprocess.STARTF_USESHOWWINDOW
    else:
      assert kwargs == {}


def test_lambda_deploy_sse_content_type(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.lambda_deploy.stream_lambda_deploy", side_effect=_mock_lambda_stream), \
         patch("routers.lambda_deploy._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/lambda/deploy")
        assert "text/event-stream" in response.headers.get("content-type", "")


def test_lambda_deploy_emits_real_stage_sequence(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.lambda_deploy.stream_lambda_deploy", side_effect=_mock_lambda_stream), \
         patch("routers.lambda_deploy._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/lambda/deploy")
        events = _parse_sse_events(response.text)

    stages = [event["stage"] for event in events]
    assert stages == [
        "lambda-package",
        "lambda-upload",
        "lambda-deploy",
        "lambda-live",
        "done",
    ]


def test_successful_lambda_deploy_touches_lambda_marker(tmp_path):
    from main import app
    from services.watcher import get_lambda_sync_marker_path

    cfg = _make_config(tmp_path)

    with patch("routers.lambda_deploy.stream_lambda_deploy", side_effect=_mock_lambda_stream), \
         patch("routers.lambda_deploy._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/lambda/deploy")

    assert get_lambda_sync_marker_path(cfg).is_file()


def test_successful_lambda_deploy_records_history_entry(tmp_path):
    from main import app
    from services.deploy_history import clear_deploy_history, get_recent_runs

    cfg = _make_config(tmp_path)
    clear_deploy_history()

    with patch("routers.lambda_deploy.stream_lambda_deploy", side_effect=_mock_lambda_stream), \
         patch("routers.lambda_deploy._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/lambda/deploy")

    runs = get_recent_runs()
    assert runs[0]["label"] == "Lambda"
    assert runs[0]["status"] == "success"
    assert runs[0]["kind"] == "lambda"


def test_failed_lambda_deploy_does_not_touch_lambda_marker(tmp_path):
    from main import app
    from services.watcher import get_lambda_sync_marker_path

    cfg = _make_config(tmp_path)

    with patch("routers.lambda_deploy.stream_lambda_deploy", side_effect=_mock_lambda_stream_failure), \
         patch("routers.lambda_deploy._get_config", return_value=cfg):
        client = TestClient(app)
        client.post("/api/lambda/deploy")

    assert not get_lambda_sync_marker_path(cfg).exists()


def test_concurrent_lambda_deploy_returns_409():
    from main import app
    import routers.lambda_deploy as lambda_module

    loop = asyncio.new_event_loop()
    loop.run_until_complete(lambda_module._lambda_lock.acquire())

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/lambda/deploy")
        assert response.status_code == 409
    finally:
        lambda_module._lambda_lock.release()
        loop.close()
