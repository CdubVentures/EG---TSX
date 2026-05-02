"""
Infra dependency status endpoint.

Returns real deploy dependencies, Lambda watch ownership, and operator-facing
health checks derived from config, CloudFormation outputs, live Lambda lookup,
and the local watcher state.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess

from fastapi import APIRouter

from config import AppConfig
from routers.lambda_catalog import load_live_lambda_functions
from services.ttl_cache import TtlCache
from services.watcher import CATEGORY_PREFIXES, LAMBDA_CATEGORIES, get_pending_changes

logger = logging.getLogger("deploy-dashboard.infra")

router = APIRouter()

_infra_cache = TtlCache(ttl_seconds=30.0)
_stack_cache = TtlCache(ttl_seconds=60.0)


def _get_config() -> AppConfig:
    from main import config
    return config


def _run_json(args: list[str], config: AppConfig) -> dict:
    startupinfo = None
    creationflags = 0
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE
        creationflags = subprocess.CREATE_NO_WINDOW

    result = subprocess.run(
        args,
        cwd=str(config.project_root),
        capture_output=True,
        text=True,
        check=False,
        shell=False,
        startupinfo=startupinfo,
        creationflags=creationflags,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "AWS command failed").strip())

    return json.loads(result.stdout)


def _load_stack_outputs(config: AppConfig) -> dict[str, str]:
    cached = _stack_cache.get()
    if cached is not None:
        return cached

    payload = _run_json(
        [
            "aws",
            "cloudformation",
            "describe-stacks",
            "--stack-name",
            config.deploy_stack_name,
            "--region",
            config.aws_region,
            "--output",
            "json",
        ],
        config,
    )
    outputs = payload.get("Stacks", [{}])[0].get("Outputs", [])
    result = {
        output.get("OutputKey", ""): output.get("OutputValue", "")
        for output in outputs
        if output.get("OutputKey") and output.get("OutputValue")
    }
    _stack_cache.set(result)
    return result


def _build_resource(key: str, label: str, kind: str, status: str, detail: str) -> dict[str, str]:
    return {
        "key": key,
        "label": label,
        "kind": kind,
        "status": status,
        "detail": detail,
    }


def _build_health_check(key: str, label: str, status: str, detail: str) -> dict[str, str]:
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
    }


def _lambda_watch_paths() -> list[str]:
    return [prefix for prefix, category in CATEGORY_PREFIXES if category in LAMBDA_CATEGORIES]


def _watcher_detail(lambda_file_count: int) -> str:
    if lambda_file_count == 0:
        return "Clean"
    suffix = "" if lambda_file_count == 1 else "s"
    return f"{lambda_file_count} pending lambda file{suffix}"


def load_infra_status(config: AppConfig) -> dict:
    cached = _infra_cache.get()
    if cached is not None:
        return cached

    stack_outputs: dict[str, str] = {}
    stack_error = None
    try:
        stack_outputs = _load_stack_outputs(config)
    except Exception as exc:  # pragma: no cover - exercised through route tests
        stack_error = str(exc)
        logger.warning("Unable to resolve stack outputs: %s", exc)

    lambda_functions: list[dict] = []
    lambda_error = None
    try:
        lambda_functions = load_live_lambda_functions(config)
    except Exception as exc:  # pragma: no cover - exercised through route tests
        lambda_error = str(exc)
        logger.warning("Unable to resolve live Lambda metadata: %s", exc)

    watcher_status = get_pending_changes(config)

    bucket_from_stack = stack_outputs.get("StaticSiteBucketName", "")
    distribution_from_stack = stack_outputs.get("CloudFrontDistributionId", "")
    db_endpoint = stack_outputs.get("DatabaseEndpointAddress", "")
    lambda_name = (
        (lambda_functions[0]["name"] if lambda_functions else "")
        or stack_outputs.get("LambdaFunctionName", "")
    )

    resources = [
        _build_resource(
            "static-site-bucket",
            bucket_from_stack or config.s3_bucket or "Unavailable",
            "s3",
            "healthy" if bucket_from_stack else ("warning" if config.s3_bucket else "error"),
            "Static site bucket" if bucket_from_stack else "Static site bucket (config fallback)",
        ),
        _build_resource(
            "cloudfront-distribution",
            distribution_from_stack or config.cloudfront_distribution_id or "Unavailable",
            "cloudfront",
            "healthy" if distribution_from_stack else ("warning" if config.cloudfront_distribution_id else "error"),
            "CloudFront distribution" if distribution_from_stack else "CloudFront distribution (config fallback)",
        ),
        _build_resource(
            "lambda-runtime",
            lambda_name or "Unavailable",
            "lambda",
            "healthy" if lambda_functions else ("warning" if lambda_name else "error"),
            "Shared SSR runtime" if lambda_functions else ("Shared SSR runtime (stack output)" if lambda_name else "Live Lambda lookup failed"),
        ),
        _build_resource(
            "search-database",
            db_endpoint or "Unavailable",
            "rds",
            "healthy" if db_endpoint else "error",
            "Search database endpoint" if db_endpoint else "Search database endpoint missing from stack outputs",
        ),
    ]

    health_checks = [
        _build_health_check(
            "deploy-config",
            "Deploy config",
            "healthy" if config.aws_region and config.s3_bucket and config.cloudfront_distribution_id else "error",
            f"{config.aws_region} | {config.s3_bucket} | {config.cloudfront_distribution_id}",
        ),
        _build_health_check(
            "stack-outputs",
            "Stack outputs",
            "healthy" if stack_error is None else "error",
            config.deploy_stack_name if stack_error is None else stack_error,
        ),
        _build_health_check(
            "lambda-runtime",
            "Lambda runtime",
            "healthy" if lambda_functions else ("warning" if lambda_name else "error"),
            f"{len(lambda_functions)} function resolved from AWS" if lambda_functions else (lambda_name if lambda_name else (lambda_error or "Live Lambda lookup failed")),
        ),
        _build_health_check(
            "search-database",
            "Search database",
            "healthy" if db_endpoint else "error",
            "Endpoint resolved from stack outputs" if db_endpoint else "Endpoint unresolved",
        ),
        _build_health_check(
            "lambda-watcher",
            "Lambda watcher",
            "warning" if watcher_status.has_lambda_changes else "healthy",
            _watcher_detail(len(watcher_status.lambda_files)),
        ),
    ]

    lambda_folder_status = "warning" if watcher_status.has_lambda_changes else "healthy"
    lambda_folders = [
        {
            "path": path,
            "functionName": lambda_name or "Unavailable",
            "status": lambda_folder_status if lambda_name else "error",
        }
        for path in _lambda_watch_paths()
    ]

    result = {
        "resources": resources,
        "lambdaFolders": lambda_folders,
        "healthChecks": health_checks,
        "error": stack_error,
    }
    _infra_cache.set(result)
    return result


@router.get("/infra/status")
async def api_infra_status():
    config = _get_config()
    return load_infra_status(config)
