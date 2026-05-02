"""
Phase 1 tests — config resolution and health endpoint.
"""

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from config import AppConfig, load_config, parse_run_config


# ── Config resolution tests ──────────────────────────────────────────


def test_project_root_resolves():
    cfg = load_config()
    assert cfg.project_root.is_dir(), f"{cfg.project_root} is not a directory"


def test_project_root_has_package_json():
    cfg = load_config()
    assert (cfg.project_root / "package.json").is_file()


def test_src_dir_exists():
    cfg = load_config()
    assert cfg.src_dir.is_dir(), f"{cfg.src_dir} is not a directory"


def test_paths_are_absolute():
    cfg = load_config()
    path_fields = [
        cfg.project_root,
        cfg.src_dir,
        cfg.dist_dir,
        cfg.dist_client_dir,
        cfg.public_dir,
        cfg.astro_cache_dir,
        cfg.vite_cache_dir,
        cfg.sync_marker_path,
    ]
    for p in path_fields:
        assert p.is_absolute(), f"{p} is not absolute"


def test_s3_bucket_not_empty():
    cfg = load_config()
    assert cfg.s3_bucket, "s3_bucket should not be empty"
    assert isinstance(cfg.s3_bucket, str)


def test_aws_region_has_default():
    cfg = load_config()
    assert cfg.aws_region == "us-east-2"


def test_load_config_reads_env_deploy_values(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import config as config_module

    default_root = tmp_path / "default-site"
    default_root.mkdir(parents=True, exist_ok=True)
    configured_root = tmp_path / "portable-site"
    configured_root.mkdir(parents=True, exist_ok=True)
    tool_root = tmp_path / "deploy-dashboard"
    tool_root.mkdir(parents=True, exist_ok=True)

    (tool_root / ".env.deploy").write_text(
        "\n".join(
            [
                f"DEPLOY_PROJECT_ROOT={configured_root.as_posix()}",
                "DEPLOY_SRC_DIR=app-src",
                "DEPLOY_PUBLIC_DIR=static",
                "DEPLOY_STATIC_OUTPUT_DIR=build/client",
                "DEPLOY_ASTRO_CACHE_DIR=.cache/astro",
                "DEPLOY_VITE_CACHE_DIR=.cache/vite",
                "DEPLOY_SCRIPT_PATH=ops/deploy-custom.mjs",
                "DEPLOY_STACK_NAME=portable-astro-prod",
                "DEPLOY_S3_BUCKET=portable-bucket",
                "AWS_REGION=us-west-1",
                "DEPLOY_CLOUDFRONT_ID=EDOTENV123",
                "DEPLOY_DASHBOARD_PORT=9100",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(config_module, "_resolve_project_root", lambda: default_root)
    monkeypatch.setattr(config_module, "_resolve_tool_root", lambda: tool_root, raising=False)
    for key in (
        "DEPLOY_PROJECT_ROOT",
        "DEPLOY_SRC_DIR",
        "DEPLOY_PUBLIC_DIR",
        "DEPLOY_STATIC_OUTPUT_DIR",
        "DEPLOY_ASTRO_CACHE_DIR",
        "DEPLOY_VITE_CACHE_DIR",
        "DEPLOY_SCRIPT_PATH",
        "DEPLOY_STACK_NAME",
        "DEPLOY_S3_BUCKET",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "DEPLOY_CLOUDFRONT_ID",
        "DEPLOY_DASHBOARD_PORT",
    ):
        monkeypatch.delenv(key, raising=False)

    cfg = load_config()

    assert cfg.project_root == configured_root
    assert cfg.src_dir == configured_root / "app-src"
    assert cfg.public_dir == configured_root / "static"
    assert cfg.dist_dir == configured_root / "build"
    assert cfg.dist_client_dir == configured_root / "build" / "client"
    assert cfg.astro_cache_dir == configured_root / ".cache" / "astro"
    assert cfg.vite_cache_dir == configured_root / ".cache" / "vite"
    assert cfg.deploy_script_path == configured_root / "ops" / "deploy-custom.mjs"
    assert cfg.deploy_stack_name == "portable-astro-prod"
    assert cfg.s3_bucket == "portable-bucket"
    assert cfg.aws_region == "us-west-1"
    assert cfg.cloudfront_distribution_id == "EDOTENV123"
    assert cfg.port == 9100


def test_process_env_overrides_env_deploy_values(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import config as config_module

    file_root = tmp_path / "file-site"
    env_root = tmp_path / "env-site"
    file_root.mkdir(parents=True, exist_ok=True)
    env_root.mkdir(parents=True, exist_ok=True)
    tool_root = tmp_path / "deploy-dashboard"
    tool_root.mkdir(parents=True, exist_ok=True)

    (tool_root / ".env.deploy").write_text(
        "\n".join(
            [
                f"DEPLOY_PROJECT_ROOT={file_root.as_posix()}",
                "DEPLOY_SCRIPT_PATH=ops/from-file.mjs",
                "DEPLOY_STACK_NAME=file-stack",
                "DEPLOY_S3_BUCKET=file-bucket",
                "AWS_REGION=us-east-1",
                "DEPLOY_CLOUDFRONT_ID=FILECF123",
                "DEPLOY_DASHBOARD_PORT=8420",
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(config_module, "_resolve_project_root", lambda: tmp_path / "default-site")
    monkeypatch.setattr(config_module, "_resolve_tool_root", lambda: tool_root, raising=False)
    monkeypatch.setenv("DEPLOY_PROJECT_ROOT", str(env_root))
    monkeypatch.setenv("DEPLOY_SCRIPT_PATH", "ops/from-env.mjs")
    monkeypatch.setenv("DEPLOY_STACK_NAME", "env-stack")
    monkeypatch.setenv("DEPLOY_S3_BUCKET", "env-bucket")
    monkeypatch.setenv("AWS_REGION", "us-central-1")
    monkeypatch.setenv("DEPLOY_CLOUDFRONT_ID", "ENVCF999")
    monkeypatch.setenv("DEPLOY_DASHBOARD_PORT", "9200")

    cfg = load_config()

    assert cfg.project_root == env_root
    assert cfg.deploy_script_path == env_root / "ops" / "from-env.mjs"
    assert cfg.deploy_stack_name == "env-stack"
    assert cfg.s3_bucket == "env-bucket"
    assert cfg.aws_region == "us-central-1"
    assert cfg.cloudfront_distribution_id == "ENVCF999"
    assert cfg.port == 9200


# ── parse_run_config tests ───────────────────────────────────────────


def test_parse_run_config_basic(tmp_path: Path):
    cmd_file = tmp_path / "run-config.cmd"
    cmd_file.write_text("set FOO=bar\nset BAZ=qux\n", encoding="utf-8")
    result = parse_run_config(cmd_file)
    assert result == {"FOO": "bar", "BAZ": "qux"}


def test_parse_run_config_skips_comments(tmp_path: Path):
    cmd_file = tmp_path / "run-config.cmd"
    cmd_file.write_text(
        "@echo off\nREM This is a comment\nset REAL_KEY=value\n",
        encoding="utf-8",
    )
    result = parse_run_config(cmd_file)
    assert result == {"REAL_KEY": "value"}
    assert "echo" not in str(result).lower()


def test_parse_run_config_missing_file():
    result = parse_run_config(Path("/nonexistent/path/run-config.cmd"))
    assert result == {}


# ── Health endpoint test ─────────────────────────────────────────────


def test_health_endpoint():
    from main import app

    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "project_root" in data
    assert "s3_bucket" in data
    assert "aws_region" in data
