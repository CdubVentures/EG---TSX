"""
Phase 4 tests -- SSE streaming runner (subprocess -> async line generator).
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path

import pytest

# We need the runner module's types and functions
# Import after writing services/runner.py


async def _collect(gen):
    """Drain an async generator into a list."""
    items = []
    async for item in gen:
        items.append(item)
    return items


@pytest.fixture
def tmp_cwd(tmp_path):
    return tmp_path


def _make_step(stage, args, cwd):
    from services.runner import CommandStep
    return CommandStep(label=stage, stage=stage, args=args, cwd=cwd)


# -- Tests ---------------------------------------------------------------------


def test_single_echo_command(tmp_cwd):
    from services.runner import CommandStep, run_step

    step = _make_step("test", [sys.executable, "-c", "print('hello')"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    stdout_lines = [l for l in lines if l.source == "stdout"]
    assert len(stdout_lines) == 1
    assert stdout_lines[0].line == "hello"
    assert stdout_lines[0].source == "stdout"


def test_multi_line_output(tmp_cwd):
    from services.runner import run_step

    step = _make_step("test", [sys.executable, "-c", "print('a');print('b');print('c')"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    stdout_lines = [l for l in lines if l.source == "stdout"]
    assert [l.line for l in stdout_lines] == ["a", "b", "c"]


def test_stderr_captured(tmp_cwd):
    from services.runner import run_step

    step = _make_step("test", [sys.executable, "-c", "import sys; sys.stderr.write('warn\\n')"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    stderr_lines = [l for l in lines if l.source == "stderr"]
    assert len(stderr_lines) == 1
    assert stderr_lines[0].line == "warn"


def test_mixed_stdout_stderr(tmp_cwd):
    from services.runner import run_step

    script = "import sys; print('out1'); sys.stderr.write('err1\\n'); print('out2')"
    step = _make_step("test", [sys.executable, "-c", script], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    sources = [l.source for l in lines]
    assert "stdout" in sources
    assert "stderr" in sources
    all_text = [l.line for l in lines]
    assert "out1" in all_text
    assert "err1" in all_text
    assert "out2" in all_text


def test_failed_command_raises(tmp_cwd):
    from services.runner import run_step

    step = _make_step("test", [sys.executable, "-c", "exit(1)"], tmp_cwd)

    with pytest.raises(subprocess.CalledProcessError):
        asyncio.run(_collect(run_step(step)))


def test_sequential_steps(tmp_cwd):
    from services.runner import CommandStep, stream_commands

    steps = [
        _make_step("step1", [sys.executable, "-c", "print('first')"], tmp_cwd),
        _make_step("step2", [sys.executable, "-c", "print('second')"], tmp_cwd),
    ]

    lines = asyncio.run(_collect(stream_commands(steps)))

    text_lines = [l.line for l in lines if l.source == "stdout"]
    assert "first" in text_lines
    assert "second" in text_lines
    # first should come before second
    assert text_lines.index("first") < text_lines.index("second")


def test_stage_tags_correct(tmp_cwd):
    from services.runner import stream_commands

    steps = [
        _make_step("alpha", [sys.executable, "-c", "print('a')"], tmp_cwd),
        _make_step("beta", [sys.executable, "-c", "print('b')"], tmp_cwd),
    ]

    lines = asyncio.run(_collect(stream_commands(steps)))

    stdout_lines = [l for l in lines if l.source == "stdout"]
    alpha_lines = [l for l in stdout_lines if l.stage == "alpha"]
    beta_lines = [l for l in stdout_lines if l.stage == "beta"]
    assert len(alpha_lines) >= 1
    assert len(beta_lines) >= 1
    assert alpha_lines[0].line == "a"
    assert beta_lines[0].line == "b"


def test_format_sse_output():
    from services.runner import format_sse

    result = format_sse({"foo": "bar"})
    assert result == 'data: {"foo": "bar"}\n\n'


def test_empty_output_command(tmp_cwd):
    from services.runner import run_step

    # Command that produces no output
    step = _make_step("test", [sys.executable, "-c", "pass"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    stdout_lines = [l for l in lines if l.source == "stdout"]
    assert len(stdout_lines) == 0


def test_on_complete_called(tmp_cwd):
    from services.runner import stream_commands

    called = []

    def on_done():
        called.append(True)

    steps = [
        _make_step("s1", [sys.executable, "-c", "print('ok')"], tmp_cwd),
        _make_step("s2", [sys.executable, "-c", "print('ok')"], tmp_cwd),
    ]

    asyncio.run(_collect(stream_commands(steps, on_complete=on_done)))
    assert called == [True]


def test_on_complete_not_called_on_failure(tmp_cwd):
    from services.runner import stream_commands

    called = []

    def on_done():
        called.append(True)

    steps = [
        _make_step("s1", [sys.executable, "-c", "exit(1)"], tmp_cwd),
    ]

    with pytest.raises(subprocess.CalledProcessError):
        asyncio.run(_collect(stream_commands(steps, on_complete=on_done)))

    assert called == []


def test_long_lines_not_truncated(tmp_cwd):
    from services.runner import run_step

    long_text = "X" * 5000
    step = _make_step("test", [sys.executable, "-c", f"print('{long_text}')"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    stdout_lines = [l for l in lines if l.source == "stdout"]
    assert len(stdout_lines) == 1
    assert len(stdout_lines[0].line) == 5000


def test_timestamp_present(tmp_cwd):
    from services.runner import run_step

    step = _make_step("test", [sys.executable, "-c", "print('ts')"], tmp_cwd)
    lines = asyncio.run(_collect(run_step(step)))

    for line in lines:
        assert line.timestamp, f"Empty timestamp on line: {line}"
        assert "T" in line.timestamp  # ISO 8601 has a T separator
