"""
Live Lambda metadata endpoint for the deploy dashboard.

Returns deployed Lambda configuration from CloudFormation outputs and
`aws lambda get-function-configuration` so the UI does not invent functions.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess

from fastapi import APIRouter

from config import AppConfig
from services.ttl_cache import TtlCache

logger = logging.getLogger("deploy-dashboard.lambda-catalog")

router = APIRouter()

_lambda_cache = TtlCache(ttl_seconds=60.0)


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


def _extract_lambda_function_names(stack_payload: dict) -> list[str]:
    outputs = stack_payload.get("Stacks", [{}])[0].get("Outputs", [])
    names: list[str] = []
    for output in outputs:
        key = output.get("OutputKey", "")
        value = output.get("OutputValue", "")
        if not value:
            continue
        if key == "LambdaFunctionName" or key.endswith("LambdaFunctionName"):
            names.append(value)

    return list(dict.fromkeys(names))


def _format_runtime(runtime: str) -> str:
    mapping = {
        "nodejs20.x": "Node.js 20.x",
        "python3.11": "Python 3.11",
    }
    return mapping.get(runtime, runtime or "Unknown")


def load_live_lambda_functions(config: AppConfig) -> list[dict]:
    cached = _lambda_cache.get()
    if cached is not None:
        return cached

    stack_payload = _run_json(
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
    function_names = _extract_lambda_function_names(stack_payload)
    if not function_names:
        raise RuntimeError("No LambdaFunctionName output found in the deployed stack.")

    functions: list[dict] = []
    for function_name in function_names:
        payload = _run_json(
            [
                "aws",
                "lambda",
                "get-function-configuration",
                "--function-name",
                function_name,
                "--region",
                config.aws_region,
                "--output",
                "json",
            ],
            config,
        )
        functions.append(
            {
                "arn": payload.get("FunctionArn", ""),
                "mem": f'{payload.get("MemorySize", 0)} MB',
                "name": payload.get("FunctionName", function_name),
                "purpose": payload.get("Description") or "No AWS Lambda description set.",
                "runtime": _format_runtime(payload.get("Runtime", "")),
                "source": "aws",
                "timeout": f'{payload.get("Timeout", 0)}s',
            }
        )

    _lambda_cache.set(functions)
    return functions


@router.get("/lambda/functions")
async def api_lambda_functions():
    config = _get_config()
    try:
        return {"functions": load_live_lambda_functions(config), "error": None}
    except Exception as exc:  # pragma: no cover - covered by route test via patch
        logger.warning("Unable to load live Lambda metadata: %s", exc)
        return {"functions": [], "error": str(exc)}
