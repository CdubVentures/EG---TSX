"""
EG Deploy Dashboard — Standalone Launcher.

Double-click this file to open the dashboard in its own window.
No browser, no terminal. Closes the server when the window closes.

Uses pythonw.exe (.pyw) to suppress the console window on Windows.
"""

import json
import math
import os
import socket
import subprocess
import sys
import threading
import time

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
APP_TITLE = "EG Deploy Control Center"
_TOOL_ROOT = os.path.dirname(_THIS_DIR)
_UI_DIR = os.path.join(_TOOL_ROOT, "ui")
ICON_PATH = os.path.join(_UI_DIR, "assets", "eg-deploy-control-center.ico")
os.chdir(_THIS_DIR)
sys.path.insert(0, _THIS_DIR)

import uvicorn
import webview

PORT = 8420
UI_SCALE = 1.25
WINDOW_WIDTH = 2075
WINDOW_MIN_HEIGHT = 1200
WINDOW_DEFAULT_HEIGHT = 2000

_PROJECT_ROOT = os.path.abspath(os.path.join(_TOOL_ROOT, "..", ".."))
_BUNDLE_PATH = os.path.join(_UI_DIR, "app.bundle.js")
_ENTRY_PATH = os.path.join(_UI_DIR, "_entry.jsx")


def get_work_area_height():
    if os.name != "nt":
        return None

    try:
        import ctypes

        class _Rect(ctypes.Structure):
            _fields_ = [
                ("left", ctypes.c_long),
                ("top", ctypes.c_long),
                ("right", ctypes.c_long),
                ("bottom", ctypes.c_long),
            ]

        rect = _Rect()
        if ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0):
            return max(int(rect.bottom - rect.top), 0)
    except Exception:
        return None

    return None


def calculate_initial_window_height(_work_area_height=None):
    if _work_area_height:
        return min(int(_work_area_height), WINDOW_DEFAULT_HEIGHT)
    return WINDOW_DEFAULT_HEIGHT


def _is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def _pick_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def select_port(preferred_port=PORT, is_port_available=_is_port_available, pick_free_port=_pick_free_port):
    if is_port_available(preferred_port):
        return preferred_port

    return pick_free_port()


def build_dashboard_url(port):
    return f"http://127.0.0.1:{port}"


def build_launcher_css(scale=UI_SCALE):
    scale_token = f"{scale:.2f}".rstrip("0").rstrip(".")
    return (
        f":root{{--launcher-scale:{scale_token};}}"
        "html,body{overflow:hidden !important;}"
        "#root{height:calc(100% / var(--launcher-scale)) !important;"
        "width:calc(100% / var(--launcher-scale)) !important;"
        "overflow:auto !important;overflow-x:hidden !important;"
        "transform:scale(var(--launcher-scale));transform-origin:top left;}"
        "#root > div{height:100% !important;min-height:0 !important;}"
    )


def build_content_metrics_script():
    return """\
JSON.stringify((() => {
  const root = document.getElementById("root");
  const app = root && root.firstElementChild;
  return {
    appScrollHeight: app ? Math.ceil(app.scrollHeight) : 0,
    outerHeight: window.outerHeight || 0,
    innerHeight: window.innerHeight || 0
  };
})())
"""


def calculate_target_window_height(metrics, scale=UI_SCALE, min_height=WINDOW_MIN_HEIGHT, work_area_height=None):
    app_scroll_height = int(metrics.get("appScrollHeight", 0) or 0)
    outer_height = int(metrics.get("outerHeight", 0) or 0)
    inner_height = int(metrics.get("innerHeight", 0) or 0)
    chrome_height = max(outer_height - inner_height, 0)

    if app_scroll_height <= 0:
        target_height = max(min_height, WINDOW_DEFAULT_HEIGHT)
    else:
        target_height = max(min_height, WINDOW_DEFAULT_HEIGHT, math.ceil(app_scroll_height * scale) + chrome_height)

    if work_area_height:
        return min(int(work_area_height), target_height)

    return target_height


def sync_launcher_layout(window, scale=UI_SCALE, work_area_height=None):
    window.load_css(build_launcher_css(scale))
    raw_metrics = window.evaluate_js(build_content_metrics_script())

    if isinstance(raw_metrics, str):
        try:
            metrics = json.loads(raw_metrics)
        except json.JSONDecodeError:
            metrics = {}
    else:
        metrics = raw_metrics or {}

    target_height = calculate_target_window_height(metrics, scale=scale, work_area_height=work_area_height)
    window.resize(WINDOW_WIDTH, target_height)
    return target_height


def configure_window(window, scale=UI_SCALE, work_area_height=None):
    def _load_launcher_css(window):
        window.load_css(build_launcher_css(scale))

    window.events.loaded += _load_launcher_css
    return window


def build_window_options(url, initial_height):
    return {
        "title": APP_TITLE,
        "url": url,
        "width": WINDOW_WIDTH,
        "height": initial_height,
        "min_size": (1600, WINDOW_MIN_HEIGHT),
        "text_select": True,
    }


def _build_bundle():
    """Compile the dashboard JSX → single JS bundle via esbuild."""
    subprocess.run(
        [
            "npx", "esbuild",
            _ENTRY_PATH,
            "--bundle",
            "--format=iife",
            "--jsx=transform",
            "--charset=utf8",
            "--minify",
            f"--outfile={_BUNDLE_PATH}",
        ],
        cwd=_PROJECT_ROOT,
        shell=True,
        capture_output=True,
    )


def _start_server(port):
    """Run uvicorn in a background thread."""
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


def _wait_for_server(url, timeout=15):
    """Block until the server responds, or timeout."""
    import urllib.request
    import urllib.error

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{url}/api/health", timeout=1)
            return True
        except (urllib.error.URLError, ConnectionError, OSError):
            time.sleep(0.3)
    return False


def main():
    # Build the bundle first (fast — ~50ms)
    _build_bundle()
    port = select_port()
    url = build_dashboard_url(port)
    os.environ["DEPLOY_DASHBOARD_PORT"] = str(port)

    # Start the FastAPI server in a daemon thread
    server_thread = threading.Thread(target=_start_server, args=(port,), daemon=True)
    server_thread.start()

    # Wait for server to be ready
    _wait_for_server(url)

    initial_height = calculate_initial_window_height()

    # Open the native window at a fixed height; user resizing is manual.
    window = configure_window(webview.create_window(**build_window_options(url, initial_height)))

    # webview.start() blocks until the window is closed.
    # daemon=True on the server thread means it dies with the process.
    webview.start(icon=ICON_PATH, private_mode=False)


if __name__ == "__main__":
    main()
