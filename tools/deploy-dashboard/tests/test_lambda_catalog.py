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


def test_load_live_lambda_functions_maps_stack_output_and_lambda_config(tmp_path):
    from routers.lambda_catalog import load_live_lambda_functions

    cfg = _make_config(tmp_path)

    with patch(
        "routers.lambda_catalog._run_json",
        side_effect=[
            {
                "Stacks": [
                    {
                        "Outputs": [
                            {"OutputKey": "LambdaFunctionName", "OutputValue": "eggear-tsx-ssr"},
                        ]
                    }
                ]
            },
            {
                "FunctionName": "eggear-tsx-ssr",
                "Runtime": "nodejs20.x",
                "MemorySize": 512,
                "Timeout": 30,
                "FunctionArn": "arn:aws:lambda:us-east-2:536822304889:function:eggear-tsx-ssr",
                "Description": "EG-TSX dynamic runtime for search, auth, and user APIs behind CloudFront.",
            },
        ],
    ):
        assert load_live_lambda_functions(cfg) == [
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


def test_lambda_functions_endpoint_returns_live_aws_cards(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)
    payload = [
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

    with patch("routers.lambda_catalog._get_config", return_value=cfg), patch(
        "routers.lambda_catalog.load_live_lambda_functions", return_value=payload
    ):
        client = TestClient(app)
        response = client.get("/api/lambda/functions")

    assert response.status_code == 200
    assert response.json() == {"error": None, "functions": payload}


def test_lambda_functions_endpoint_surfaces_lookup_failure_without_fake_cards(tmp_path):
    from main import app

    cfg = _make_config(tmp_path)

    with patch("routers.lambda_catalog._get_config", return_value=cfg), patch(
        "routers.lambda_catalog.load_live_lambda_functions",
        side_effect=RuntimeError("aws lookup failed"),
    ):
        client = TestClient(app)
        response = client.get("/api/lambda/functions")

    assert response.status_code == 200
    assert response.json() == {"error": "aws lookup failed", "functions": []}


def test_load_live_lambda_functions_uses_configured_stack_name(tmp_path):
    from routers.lambda_catalog import load_live_lambda_functions

    project_root = tmp_path / "repo"
    project_root.mkdir(parents=True, exist_ok=True)
    cfg = SimpleNamespace(
        project_root=project_root,
        aws_region="us-east-2",
        deploy_stack_name="portable-astro-prod",
    )
    observed_stack_names: list[str] = []

    def _fake_run_json(args: list[str], _config):
        if "describe-stacks" in args:
            observed_stack_names.append(args[args.index("--stack-name") + 1])
            return {
                "Stacks": [
                    {
                        "Outputs": [
                            {"OutputKey": "LambdaFunctionName", "OutputValue": "portable-ssr"},
                        ]
                    }
                ]
            }

        return {
            "FunctionName": "portable-ssr",
            "Runtime": "nodejs20.x",
            "MemorySize": 256,
            "Timeout": 15,
            "FunctionArn": "arn:aws:lambda:us-east-2:123:function:portable-ssr",
            "Description": "Portable SSR runtime",
        }

    with patch("routers.lambda_catalog._run_json", side_effect=_fake_run_json):
        load_live_lambda_functions(cfg)

    assert observed_stack_names == ["portable-astro-prod"]
