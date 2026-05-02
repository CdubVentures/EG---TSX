from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import uvicorn
import webview


_THIS_DIR = Path(__file__).resolve().parent
_CONFIG_ROOT = _THIS_DIR.parent
_PROJECT_ROOT = _CONFIG_ROOT.parent
_UI_DIR = _CONFIG_ROOT / "ui"

APP_TITLE = "EG Config Manager"
ICON_PATH = _PROJECT_ROOT / "public" / "images" / "favicons" / "favicon.ico"
PORT = 8430
WINDOW_WIDTH = 1859
WINDOW_HEIGHT = 1202
WINDOW_MIN_WIDTH = 1210
WINDOW_MIN_HEIGHT = 886

_ENTRY_PATH = _UI_DIR / "_entry.tsx"
_BUNDLE_PATH = _UI_DIR / "app.bundle.js"

os.chdir(_THIS_DIR)
if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))


def _is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def select_port(preferred_port: int = PORT) -> int:
    if _is_port_available(preferred_port):
        return preferred_port
    return _pick_free_port()


def build_url(port: int) -> str:
    return f"http://127.0.0.1:{port}"


def _build_bundle() -> None:
    result = subprocess.run(
        [
            "npx",
            "esbuild",
            str(_ENTRY_PATH),
            "--bundle",
            "--format=iife",
            "--jsx=automatic",
            "--charset=utf8",
            f"--outfile={_BUNDLE_PATH}",
        ],
        cwd=_PROJECT_ROOT,
        shell=True,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "Failed to build config bundle")


def _start_server(port: int) -> None:
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


def _wait_for_server(url: str, timeout: int = 15) -> bool:
    import urllib.error
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1):
                return True
        except (urllib.error.URLError, ConnectionError, OSError):
            time.sleep(0.25)
    return False


def main() -> None:
    _build_bundle()
    port = select_port()
    url = build_url(port)

    server_thread = threading.Thread(target=_start_server, args=(port,), daemon=True)
    server_thread.start()
    if not _wait_for_server(url):
        sys.exit(f"Server failed to start at {url} within timeout")

    window = webview.create_window(
        title=APP_TITLE,
        url=url,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT),
        text_select=True,
    )
    webview.start(icon=str(ICON_PATH), private_mode=False)


if __name__ == "__main__":
    main()
