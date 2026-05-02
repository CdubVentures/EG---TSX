from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from config import AppConfig


def _make_config(tmp_path: Path) -> AppConfig:
    project_root = tmp_path / "repo"
    project_root.mkdir(parents=True, exist_ok=True)
    return AppConfig(
        project_root=project_root,
        src_dir=project_root / "src",
        dist_dir=project_root / "dist",
        dist_client_dir=project_root / "dist" / "client",
        public_dir=project_root / "public",
        astro_cache_dir=project_root / ".astro",
        vite_cache_dir=project_root / "node_modules" / ".vite",
        sync_marker_path=project_root / ".last_sync_success",
        s3_bucket="eggear-tsx",
        aws_region="us-east-2",
        cloudfront_distribution_id="E1ITXKZVMDZMZ5",
        port=8420,
    )


def test_load_infra_status_returns_real_resources_lambda_mappings_and_health(tmp_path):
    from routers.infra_status import load_infra_status
    from services.watcher import ChangedFile, WatcherStatus

    cfg = _make_config(tmp_path)
    stack_payload = {
        "Stacks": [
            {
                "Outputs": [
                    {"OutputKey": "StaticSiteBucketName", "OutputValue": "eggear-tsx-prod"},
                    {"OutputKey": "DatabaseEndpointAddress", "OutputValue": "eg-tsx-db.abc.us-east-2.rds.amazonaws.com"},
                    {"OutputKey": "LambdaFunctionName", "OutputValue": "eggear-tsx-ssr"},
                    {"OutputKey": "CloudFrontDistributionId", "OutputValue": "E1REALCF123"},
                ]
            }
        ]
    }
    lambda_payload = [
        {
            "arn": "arn:aws:lambda:us-east-2:536822304889:function:eggear-tsx-ssr",
            "mem": "512 MB",
            "name": "eggear-tsx-ssr",
            "purpose": "EG-TSX dynamic runtime for search, auth, and user APIs behind CloudFront.",
            "runtime": "Node.js 20.x",
            "source": "aws",
            "timeout": "30s",
        }
    ]
    watcher_status = WatcherStatus(
        pending=True,
        count=3,
        last_sync_at="2026-03-08T00:00:00+00:00",
        files=[],
        lambda_files=[
            ChangedFile(
                path="src/pages/api/search.ts",
                file_type="MODIFIED",
                category="api",
                mtime="2026-03-08T00:05:00+00:00",
            )
        ],
        has_product_changes=False,
        has_lambda_changes=True,
    )

    with patch("routers.infra_status._run_json", return_value=stack_payload), patch(
        "routers.infra_status.load_live_lambda_functions", return_value=lambda_payload
    ), patch("routers.infra_status.get_pending_changes", return_value=watcher_status):
        payload = load_infra_status(cfg)

    assert payload["error"] is None
    assert payload["resources"] == [
        {
            "key": "static-site-bucket",
            "label": "eggear-tsx-prod",
            "kind": "s3",
            "status": "healthy",
            "detail": "Static site bucket",
        },
        {
            "key": "cloudfront-distribution",
            "label": "E1REALCF123",
            "kind": "cloudfront",
            "status": "healthy",
            "detail": "CloudFront distribution",
        },
        {
            "key": "lambda-runtime",
            "label": "eggear-tsx-ssr",
            "kind": "lambda",
            "status": "healthy",
            "detail": "Shared SSR runtime",
        },
        {
            "key": "search-database",
            "label": "eg-tsx-db.abc.us-east-2.rds.amazonaws.com",
            "kind": "rds",
            "status": "healthy",
            "detail": "Search database endpoint",
        },
    ]
    assert payload["lambdaFolders"] == [
        {"path": "src/pages/api/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/pages/auth/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/pages/login/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/pages/logout.ts", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/features/auth/server/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/features/search/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/features/vault/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/core/db.ts", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "src/core/media.ts", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "infrastructure/aws/", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "lambda-entry.mjs", "functionName": "eggear-tsx-ssr", "status": "warning"},
        {"path": "astro.config.mjs", "functionName": "eggear-tsx-ssr", "status": "warning"},
    ]
    assert payload["healthChecks"] == [
        {
            "key": "deploy-config",
            "label": "Deploy config",
            "status": "healthy",
            "detail": "us-east-2 | eggear-tsx | E1ITXKZVMDZMZ5",
        },
        {
            "key": "stack-outputs",
            "label": "Stack outputs",
            "status": "healthy",
            "detail": "eg-tsx-prod",
        },
        {
            "key": "lambda-runtime",
            "label": "Lambda runtime",
            "status": "healthy",
            "detail": "1 function resolved from AWS",
        },
        {
            "key": "search-database",
            "label": "Search database",
            "status": "healthy",
            "detail": "Endpoint resolved from stack outputs",
        },
        {
            "key": "lambda-watcher",
            "label": "Lambda watcher",
            "status": "warning",
            "detail": "1 pending lambda file",
        },
    ]


def test_load_infra_status_degrades_gracefully_when_stack_and_lambda_lookups_fail(tmp_path):
    from routers.infra_status import load_infra_status
    from services.watcher import WatcherStatus

    cfg = _make_config(tmp_path)
    watcher_status = WatcherStatus(
        pending=False,
        count=0,
        last_sync_at=None,
        files=[],
        lambda_files=[],
        has_product_changes=False,
        has_lambda_changes=False,
    )

    with patch("routers.infra_status._run_json", side_effect=RuntimeError("stack lookup failed")), patch(
        "routers.infra_status.load_live_lambda_functions", side_effect=RuntimeError("lambda lookup failed")
    ), patch("routers.infra_status.get_pending_changes", return_value=watcher_status):
        payload = load_infra_status(cfg)

    assert payload["error"] == "stack lookup failed"
    assert payload["resources"] == [
        {
            "key": "static-site-bucket",
            "label": "eggear-tsx",
            "kind": "s3",
            "status": "warning",
            "detail": "Static site bucket (config fallback)",
        },
        {
            "key": "cloudfront-distribution",
            "label": "E1ITXKZVMDZMZ5",
            "kind": "cloudfront",
            "status": "warning",
            "detail": "CloudFront distribution (config fallback)",
        },
        {
            "key": "lambda-runtime",
            "label": "Unavailable",
            "kind": "lambda",
            "status": "error",
            "detail": "Live Lambda lookup failed",
        },
        {
            "key": "search-database",
            "label": "Unavailable",
            "kind": "rds",
            "status": "error",
            "detail": "Search database endpoint missing from stack outputs",
        },
    ]
    assert payload["healthChecks"] == [
        {
            "key": "deploy-config",
            "label": "Deploy config",
            "status": "healthy",
            "detail": "us-east-2 | eggear-tsx | E1ITXKZVMDZMZ5",
        },
        {
            "key": "stack-outputs",
            "label": "Stack outputs",
            "status": "error",
            "detail": "stack lookup failed",
        },
        {
            "key": "lambda-runtime",
            "label": "Lambda runtime",
            "status": "error",
            "detail": "lambda lookup failed",
        },
        {
            "key": "search-database",
            "label": "Search database",
            "status": "error",
            "detail": "Endpoint unresolved",
        },
        {
            "key": "lambda-watcher",
            "label": "Lambda watcher",
            "status": "healthy",
            "detail": "Clean",
        },
    ]


def test_infra_status_route_returns_live_dependency_payload(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)
    payload = {
        "resources": [{"key": "lambda-runtime", "label": "eggear-tsx-ssr", "kind": "lambda", "status": "healthy", "detail": "Shared SSR runtime"}],
        "lambdaFolders": [{"path": "src/pages/api/", "functionName": "eggear-tsx-ssr", "status": "healthy"}],
        "healthChecks": [{"key": "lambda-watcher", "label": "Lambda watcher", "status": "healthy", "detail": "Clean"}],
        "error": None,
    }

    with patch("routers.infra_status._get_config", return_value=cfg), patch(
        "routers.infra_status.load_infra_status", return_value=payload
    ):
        client = TestClient(app)
        response = client.get("/api/infra/status")

    assert response.status_code == 200
    assert response.json() == payload


def test_load_infra_status_uses_configured_stack_name(tmp_path):
    from routers.infra_status import load_infra_status
    from services.watcher import WatcherStatus

    project_root = tmp_path / "repo"
    project_root.mkdir(parents=True, exist_ok=True)
    cfg = SimpleNamespace(
        project_root=project_root,
        aws_region="us-east-2",
        s3_bucket="portable-bucket",
        cloudfront_distribution_id="PORTABLECF123",
        deploy_stack_name="portable-astro-prod",
        lambda_watch_paths=("src/pages/api/",),
    )
    watcher_status = WatcherStatus(
        pending=False,
        count=0,
        last_sync_at=None,
        files=[],
        lambda_files=[],
        has_product_changes=False,
        has_lambda_changes=False,
    )
    observed_stack_names: list[str] = []

    def _fake_run_json(args: list[str], _config):
        observed_stack_names.append(args[args.index("--stack-name") + 1])
        return {"Stacks": [{"Outputs": []}]}

    with patch("routers.infra_status._run_json", side_effect=_fake_run_json), patch(
        "routers.infra_status.load_live_lambda_functions",
        return_value=[],
    ), patch("routers.infra_status.get_pending_changes", return_value=watcher_status):
        load_infra_status(cfg)

    assert observed_stack_names == ["portable-astro-prod"]
