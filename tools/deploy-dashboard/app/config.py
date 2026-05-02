"""
Config resolution for the Deploy Dashboard backend.

Resolves project paths, S3 bucket, and AWS region from environment
variables and infrastructure/aws/run-config.cmd.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppConfig:
    project_root: Path
    src_dir: Path
    dist_dir: Path
    dist_client_dir: Path
    public_dir: Path
    astro_cache_dir: Path
    vite_cache_dir: Path
    sync_marker_path: Path
    s3_bucket: str
    aws_region: str
    cloudfront_distribution_id: str
    port: int
    deploy_script_path: Path = Path("scripts/deploy-aws.mjs")
    deploy_stack_name: str = "eg-tsx-prod"


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse a simple dotenv-style file without adding a runtime dependency."""
    result: dict[str, str] = {}

    if not path.is_file():
        return result

    text = path.read_text(encoding="utf-8", errors="replace")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].strip()

        eq_idx = line.find("=")
        if eq_idx == -1:
            continue

        key = line[:eq_idx].strip()
        value = line[eq_idx + 1 :].strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            result[key] = value

    return result


def parse_run_config(path: Path) -> dict[str, str]:
    """
    Parse Windows batch 'set KEY=VALUE' lines from a .cmd file.
    Skips @echo, REM comments, and blank lines.
    Returns dict of key -> value.
    """
    result: dict[str, str] = {}

    if not path.is_file():
        return result

    text = path.read_text(encoding="utf-8", errors="replace")
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.lower().startswith("@echo"):
            continue
        if line.lower().startswith("rem "):
            continue

        # Match: set KEY=VALUE (case-insensitive 'set')
        if not line.lower().startswith("set "):
            continue

        after_set = line[4:].strip()
        eq_idx = after_set.find("=")
        if eq_idx == -1:
            continue

        key = after_set[:eq_idx].strip()
        value = after_set[eq_idx + 1:].strip()
        if key:
            result[key] = value

    return result


def _resolve_project_root() -> Path:
    """Resolve project root from this file's location (tools/deploy-dashboard/app/config.py -> EG - TSX/)."""
    this_dir = Path(__file__).resolve().parent
    root = this_dir.parent.parent.parent
    return root


def _resolve_tool_root() -> Path:
    """Resolve the dashboard tool root (tools/deploy-dashboard/)."""
    return Path(__file__).resolve().parent.parent


def _first_value(
    keys: tuple[str, ...],
    *,
    env_file_values: dict[str, str],
    run_config: dict[str, str] | None = None,
    default: str,
) -> str:
    for key in keys:
        value = os.environ.get(key)
        if value:
            return value

    for key in keys:
        value = env_file_values.get(key)
        if value:
            return value

    if run_config is not None:
        for key in keys:
            value = run_config.get(key)
            if value:
                return value

    return default


def _resolve_path(raw_value: str, *, base_dir: Path) -> Path:
    path = Path(raw_value)
    if path.is_absolute():
        return path
    return (base_dir / path).resolve()


def to_command_path(path: Path, *, cwd: Path) -> str:
    """Prefer cwd-relative command paths for stable logs and tests."""
    if path.is_absolute():
        try:
            return path.relative_to(cwd).as_posix()
        except ValueError:
            return str(path)
    return path.as_posix()


def load_config() -> AppConfig:
    """Build an AppConfig from process env + .env.deploy + run-config.cmd."""
    default_project_root = _resolve_project_root()
    tool_root = _resolve_tool_root()
    env_file_values = parse_env_file(tool_root / ".env.deploy")

    project_root_value = _first_value(
        ("DEPLOY_PROJECT_ROOT",),
        env_file_values=env_file_values,
        default=str(default_project_root),
    )
    project_root = _resolve_path(project_root_value, base_dir=tool_root)

    # Parse run-config.cmd for fallback values
    run_config_path = project_root / "infrastructure" / "aws" / "run-config.cmd"
    run_config = parse_run_config(run_config_path)

    static_output_dir = _resolve_path(
        _first_value(
            ("DEPLOY_STATIC_OUTPUT_DIR",),
            env_file_values=env_file_values,
            default="dist/client",
        ),
        base_dir=project_root,
    )
    dist_dir_value = env_file_values.get("DEPLOY_DIST_DIR") or os.environ.get("DEPLOY_DIST_DIR")
    dist_dir = (
        _resolve_path(dist_dir_value, base_dir=project_root)
        if dist_dir_value
        else static_output_dir.parent if static_output_dir.name == "client" else static_output_dir
    )

    src_dir = _resolve_path(
        _first_value(("DEPLOY_SRC_DIR",), env_file_values=env_file_values, default="src"),
        base_dir=project_root,
    )
    public_dir = _resolve_path(
        _first_value(("DEPLOY_PUBLIC_DIR",), env_file_values=env_file_values, default="public"),
        base_dir=project_root,
    )
    astro_cache_dir = _resolve_path(
        _first_value(
            ("DEPLOY_ASTRO_CACHE_DIR",),
            env_file_values=env_file_values,
            default=".astro",
        ),
        base_dir=project_root,
    )
    vite_cache_dir = _resolve_path(
        _first_value(
            ("DEPLOY_VITE_CACHE_DIR",),
            env_file_values=env_file_values,
            default="node_modules/.vite",
        ),
        base_dir=project_root,
    )
    sync_marker_path = _resolve_path(
        _first_value(
            ("DEPLOY_SYNC_MARKER_PATH",),
            env_file_values=env_file_values,
            default=".last_sync_success",
        ),
        base_dir=project_root,
    )
    deploy_script_path = _resolve_path(
        _first_value(
            ("DEPLOY_SCRIPT_PATH",),
            env_file_values=env_file_values,
            default="scripts/deploy-aws.mjs",
        ),
        base_dir=project_root,
    )
    deploy_stack_name = _first_value(
        ("DEPLOY_STACK_NAME", "EG_TSX_STACK_NAME"),
        env_file_values=env_file_values,
        run_config=run_config,
        default="eg-tsx-prod",
    )

    # S3 bucket: env -> .env.deploy -> run-config -> default
    s3_bucket = _first_value(
        ("DEPLOY_S3_BUCKET",),
        env_file_values=env_file_values,
        run_config=run_config,
        default="eggear-tsx",
    )

    # AWS region: env -> .env.deploy -> run-config -> default
    aws_region = _first_value(
        ("AWS_REGION", "AWS_DEFAULT_REGION"),
        env_file_values=env_file_values,
        run_config=run_config,
        default="us-east-2",
    )

    # CloudFront distribution ID: env -> .env.deploy -> run-config -> default
    cloudfront_distribution_id = _first_value(
        ("DEPLOY_CLOUDFRONT_ID",),
        env_file_values=env_file_values,
        run_config=run_config,
        default="E1ITXKZVMDZMZ5",
    )

    port = int(
        _first_value(
            ("DEPLOY_DASHBOARD_PORT",),
            env_file_values=env_file_values,
            default="8420",
        )
    )

    return AppConfig(
        project_root=project_root,
        src_dir=src_dir,
        dist_dir=dist_dir,
        dist_client_dir=static_output_dir,
        public_dir=public_dir,
        astro_cache_dir=astro_cache_dir,
        vite_cache_dir=vite_cache_dir,
        sync_marker_path=sync_marker_path,
        deploy_script_path=deploy_script_path,
        deploy_stack_name=deploy_stack_name,
        s3_bucket=s3_bucket,
        aws_region=aws_region,
        cloudfront_distribution_id=cloudfront_distribution_id,
        port=port,
    )
