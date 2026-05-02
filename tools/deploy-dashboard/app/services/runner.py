"""
SSE streaming subprocess runner.

Executes shell commands via subprocess.Popen, captures stdout/stderr
line-by-line using threads (Windows-compatible), and yields SSE events.
"""

from __future__ import annotations

import asyncio
import json
import logging
import queue
import subprocess
import sys
import threading
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("deploy-dashboard.runner")

# Tracks the currently running subprocess for graceful shutdown
_active_process: subprocess.Popen | None = None


@dataclass(frozen=True)
class CommandStep:
    label: str
    stage: str
    args: list[str]
    cwd: Path


@dataclass(frozen=True)
class SSELine:
    stage: str
    source: str
    line: str
    timestamp: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_sse(data: dict) -> str:
    """Format a dict as an SSE 'data:' line with trailing double-newline."""
    return f"data: {json.dumps(data)}\n\n"


def format_sse_line(sse_line: SSELine) -> str:
    """Format an SSELine dataclass as an SSE event string."""
    return format_sse(asdict(sse_line))


def _resolve_shell(args: list[str]) -> bool:
    """
    On Windows, npm/npx are .cmd batch files that need shell=True.
    Everything else runs without shell.
    """
    if sys.platform != "win32":
        return False
    cmd = args[0].lower() if args else ""
    return cmd in ("npm", "npx")


def _read_stream(
    stream, q: queue.Queue, source_tag: str
) -> None:
    """Thread target: read lines from a pipe, put them in the queue."""
    try:
        for raw_line in iter(stream.readline, ""):
            q.put((source_tag, raw_line.rstrip("\r\n")))
    finally:
        stream.close()
        q.put((source_tag, None))  # sentinel


def kill_active_process() -> bool:
    """Terminate the active subprocess if one is running. Returns True if killed."""
    global _active_process
    if _active_process is not None and _active_process.poll() is None:
        _active_process.terminate()
        _active_process = None
        return True
    return False


async def run_step(step: CommandStep) -> AsyncGenerator[SSELine, None]:
    """
    Run a single CommandStep, yielding SSELine objects for each line
    of stdout/stderr. Raises CalledProcessError on non-zero exit.
    """
    global _active_process
    use_shell = _resolve_shell(step.args)

    logger.info("Running: %s (cwd=%s, shell=%s)", step.args, step.cwd, use_shell)

    proc = subprocess.Popen(
        step.args,
        cwd=str(step.cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        shell=use_shell,
    )
    _active_process = proc

    q: queue.Queue = queue.Queue()

    t_out = threading.Thread(
        target=_read_stream, args=(proc.stdout, q, "stdout"), daemon=True
    )
    t_err = threading.Thread(
        target=_read_stream, args=(proc.stderr, q, "stderr"), daemon=True
    )
    t_out.start()
    t_err.start()

    closed = 0
    while closed < 2:
        try:
            source, text = q.get(timeout=0.05)
        except queue.Empty:
            await asyncio.sleep(0.01)
            continue

        if text is None:
            closed += 1
            continue

        # Skip empty lines
        if not text:
            continue

        yield SSELine(
            stage=step.stage,
            source=source,
            line=text,
            timestamp=_now_iso(),
        )

    exit_code = proc.wait()
    _active_process = None

    logger.info("Process exited: %s → code %d", step.args[0], exit_code)

    if exit_code != 0:
        yield SSELine(
            stage=step.stage,
            source="system",
            line=f"FAILED with exit code {exit_code}",
            timestamp=_now_iso(),
        )
        raise subprocess.CalledProcessError(exit_code, step.args)


async def stream_commands(
    steps: list[CommandStep],
    on_complete: Callable[[], None] | None = None,
) -> AsyncGenerator[SSELine, None]:
    """
    Execute a sequence of CommandSteps. Yield SSELine objects for each
    line of output. If any step fails, stop the pipeline. If all
    succeed, call on_complete() if provided.
    """
    for step in steps:
        yield SSELine(
            stage=step.stage,
            source="system",
            line=f"Starting: {step.label}",
            timestamp=_now_iso(),
        )

        async for sse_line in run_step(step):
            yield sse_line

    if on_complete:
        on_complete()
