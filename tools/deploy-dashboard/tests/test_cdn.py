"""
CDN invalidation endpoint tests.
"""

import asyncio
import io
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from config import AppConfig
from services.runner import SSELine


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


def _make_config_no_cf(tmp_path: Path) -> AppConfig:
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
        cloudfront_distribution_id="",
        port=8420,
    )


def test_cdn_invalidate_success(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '{"Invalidation": {"Id": "I12345"}}'

    with patch("main.config", cfg), \
         patch("routers.cdn.subprocess.run", return_value=mock_result):
        client = TestClient(app)
        r = client.post("/api/cdn/invalidate")
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["distribution_id"] == "TEST123"
        assert data["paths"] == ["/*"]


def test_cdn_invalidate_no_distribution_id(tmp_path):
    from main import app

    cfg = _make_config_no_cf(tmp_path)

    with patch("main.config", cfg):
        client = TestClient(app)
        r = client.post("/api/cdn/invalidate")
        assert r.status_code == 400
        assert "DEPLOY_CLOUDFRONT_ID" in r.json()["detail"]


def test_cdn_invalidate_aws_error(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = "An error occurred"

    with patch("main.config", cfg), \
         patch("routers.cdn.subprocess.run", return_value=mock_result):
        client = TestClient(app)
        r = client.post("/api/cdn/invalidate")
        assert r.status_code == 500


def _parse_sse_events(response_text: str) -> list[dict]:
    events = []
    for chunk in response_text.split("\n\n"):
        chunk = chunk.strip()
        if chunk.startswith("data: "):
            events.append(json.loads(chunk[6:]))
    return events


async def _mock_cdn_invalidation_stream(_config):
    for line in [
        "Starting: Invalidating CloudFront (Full)",
        "[cdn] group 1/2 invalidating /reviews/*, /guides/*",
        "[cdn] invalidation I12345 status InProgress",
        "[cdn] invalidation I12345 status Completed",
    ]:
        yield SSELine(
            stage="cdn",
            source="system",
            line=line,
            timestamp="2026-03-08T00:00:00Z",
        )


def test_cdn_invalidate_live_streams_sse_progress(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.cdn.stream_cdn_invalidation", side_effect=_mock_cdn_invalidation_stream), \
         patch("routers.cdn._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/cdn/invalidate/live")

    assert "text/event-stream" in response.headers.get("content-type", "")
    events = _parse_sse_events(response.text)
    assert [event["stage"] for event in events] == ["cdn", "cdn", "cdn", "cdn", "done"]
    assert events[-1]["line"] == "CDN invalidation complete"


async def _mock_cdn_publish_stream(_config, invalidation_mode="full", invalidate_paths=None):
    assert invalidation_mode == "smart"
    assert invalidate_paths == ["/reviews/*", "/guides/*"]
    yield SSELine(
        stage="cdn",
        source="system",
        line="Starting: Invalidating CloudFront (Smart)",
        timestamp="2026-03-08T00:00:00Z",
    )


def test_cdn_publish_live_streams_smart_publish_paths_from_request_body(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.cdn.stream_cdn_invalidation", side_effect=_mock_cdn_publish_stream) as stream_cdn_invalidation, \
         patch("routers.cdn._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post(
            "/api/cdn/publish/live",
            json={"paths": ["/reviews/*", "/guides/*"]},
        )

    assert "text/event-stream" in response.headers.get("content-type", "")
    events = _parse_sse_events(response.text)
    assert events[0]["line"] == "Starting: Invalidating CloudFront (Smart)"
    assert events[-1]["line"] == "CDN publish complete"
    stream_cdn_invalidation.assert_called_once_with(
        cfg,
        invalidation_mode="smart",
        invalidate_paths=["/reviews/*", "/guides/*"],
    )


@pytest.mark.parametrize(
    ("endpoint", "request_body", "stream_side_effect"),
    [
        ("/api/cdn/invalidate/live", None, _mock_cdn_invalidation_stream),
        (
            "/api/cdn/publish/live",
            {"paths": ["/reviews/*", "/guides/*"]},
            _mock_cdn_publish_stream,
        ),
    ],
)
def test_successful_live_cdn_actions_clear_persisted_queue_state(
    tmp_path,
    endpoint,
    request_body,
    stream_side_effect,
):
    from main import app
    from services.cdn_queue import append_cdn_queue_plan, clear_cdn_queue, get_cdn_queue_state

    cfg = _make_config(tmp_path)
    queue_file = tmp_path / "cdn_queue.json"

    with patch("services.cdn_queue._QUEUE_FILE", queue_file):
        clear_cdn_queue()
        append_cdn_queue_plan(
            label="S3 Data Publish",
            plan={
                "mode": "SMART",
                "paths": ["/reviews/*", "/guides/*"],
                "reason": "Built CDN-facing routes from the static sync diff.",
                "sourceProfile": "s3-data-publish",
            },
        )

        with patch("routers.cdn.stream_cdn_invalidation", side_effect=stream_side_effect), \
             patch("routers.cdn._get_config", return_value=cfg):
            client = TestClient(app)
            if request_body is None:
                response = client.post(endpoint)
            else:
                response = client.post(endpoint, json=request_body)

        queue_state = get_cdn_queue_state()

    assert response.status_code == 200
    assert queue_state["status"] == "CLEAR"
    assert queue_state["entries"] == []
    assert queue_state["paths"] == []


async def _mock_cdn_invalidation_stream_with_progress(_config):
    yield 'data: {"stage":"cdn","source":"system","kind":"site_stage_progress","progress":7,"detail":"Read 1/3 stack outputs"}\n\n'
    yield SSELine(
        stage="cdn",
        source="stdout",
        line="[cdn] paths: /reviews/*, /guides/*",
        timestamp="2026-03-08T00:00:00Z",
    )


def test_cdn_invalidate_live_preserves_progress_events_and_later_lines(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.cdn.stream_cdn_invalidation", side_effect=_mock_cdn_invalidation_stream_with_progress), \
         patch("routers.cdn._get_config", return_value=cfg):
        client = TestClient(app)
        response = client.post("/api/cdn/invalidate/live")

    events = _parse_sse_events(response.text)
    assert events[0]["kind"] == "site_stage_progress"
    assert events[0]["progress"] == 7
    assert events[1]["line"] == "[cdn] paths: /reviews/*, /guides/*"
    assert events[-1]["line"] == "CDN invalidation complete"


def test_stream_cdn_invalidation_passes_event_stream_env_to_popen(tmp_path):
    from routers.cdn import stream_cdn_invalidation

    cfg = _make_config(tmp_path)
    popen_kwargs = {}

    class _FakeProc:
        def __init__(self):
            self.stdout = io.StringIO('{"egTsxEvent": true, "stage": "invalidate", "label": "Invalidating CloudFront", "status": "started"}\n')
            self.stderr = io.StringIO("")

        def wait(self):
            return 0

    async def _collect():
        events = []
        async for event in stream_cdn_invalidation(cfg):
            events.append(event)
        return events

    def _fake_popen(*_args, **kwargs):
        popen_kwargs.update(kwargs)
        return _FakeProc()

    with patch("routers.cdn.subprocess.Popen", side_effect=_fake_popen):
        events = asyncio.run(_collect())

    assert events
    assert popen_kwargs["env"]["EG_TSX_EVENT_STREAM"] == "1"
    assert popen_kwargs["creationflags"] == subprocess.CREATE_NO_WINDOW
    assert popen_kwargs["startupinfo"].wShowWindow == subprocess.SW_HIDE


def test_stream_cdn_invalidation_keeps_manual_progress_monotonic_across_preflight_and_invalidation(tmp_path):
    from routers.cdn import stream_cdn_invalidation

    cfg = _make_config(tmp_path)

    class _FakeProc:
        def __init__(self):
            self.stdout = io.StringIO("\n".join([
                json.dumps({
                    "egTsxEvent": True,
                    "stage": "read-stack",
                    "label": "Refreshing Stack Outputs",
                    "status": "started",
                }),
                json.dumps({
                    "egTsxEvent": True,
                    "kind": "site_stage_progress",
                    "stage": "sync",
                    "progress": 12,
                    "detail": "Read 3/3 stack outputs",
                }),
                json.dumps({
                    "egTsxEvent": True,
                    "stage": "invalidate",
                    "label": "Invalidating CloudFront (Full)",
                    "status": "started",
                }),
                json.dumps({
                    "egTsxEvent": True,
                    "kind": "site_stage_progress",
                    "stage": "cdn",
                    "progress": 0,
                    "detail": "Submitting 2 invalidation group(s)",
                }),
                "",
            ]))
            self.stderr = io.StringIO("")

        def wait(self):
            return 0

    async def _collect():
        events = []
        async for event in stream_cdn_invalidation(cfg):
            events.append(event)
        return events

    with patch("routers.cdn.subprocess.Popen", return_value=_FakeProc()):
        events = asyncio.run(_collect())

    progress_events = [
        json.loads(event[6:].strip())
        for event in events
        if isinstance(event, str) and event.startswith("data: ")
    ]

    assert progress_events[0]["progress"] == 12
    assert progress_events[1]["progress"] > progress_events[0]["progress"]
    assert progress_events[1]["stage"] == "cdn"


def test_parse_deploy_event_maps_manual_cdn_preflight_to_cdn_stage():
    from routers.cdn import _parse_deploy_event

    event = _parse_deploy_event(
        json.dumps({
            "egTsxEvent": True,
            "stage": "read-stack",
            "label": "Refreshing Stack Outputs",
            "status": "started",
        })
    )

    assert event == {
        "label": "Refreshing Stack Outputs",
        "stage": "cdn",
        "status": "started",
    }


def test_build_cdn_invalidate_live_args_supports_manual_smart_publish_paths():
    from routers.cdn import build_cdn_invalidate_live_args

    assert build_cdn_invalidate_live_args(
        invalidation_mode="smart",
        invalidate_paths=["/reviews/*", "/guides/*"],
    ) == [
        "node",
        "scripts/deploy-aws.mjs",
        "--skip-build",
        "--skip-stack",
        "--skip-static",
        "--static-scope",
        "site",
        "--invalidation-mode",
        "smart",
        "--invalidate-path",
        "/reviews/*",
        "--invalidate-path",
        "/guides/*",
    ]


def test_build_cdn_invalidate_live_args_use_configured_script_path(tmp_path):
    from routers.cdn import build_cdn_invalidate_live_args

    cfg = SimpleNamespace(
        project_root=tmp_path,
        deploy_script_path=tmp_path / "ops" / "deploy-portable.mjs",
    )

    assert build_cdn_invalidate_live_args(
        config=cfg,
        invalidation_mode="smart",
        invalidate_paths=["/reviews/*"],
    )[1] == "ops/deploy-portable.mjs"
