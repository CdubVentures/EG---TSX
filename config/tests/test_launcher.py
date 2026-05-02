"""Tests for config.app.launcher — health-check guard."""

from __future__ import annotations

import types

import pytest


def test_main_raises_when_server_never_healthy(monkeypatch):
    """main() must not open a window if the server never responds."""
    import config.app.launcher as launcher

    monkeypatch.setattr(launcher, "_build_bundle", lambda: None)
    monkeypatch.setattr(launcher, "select_port", lambda: 9999)
    monkeypatch.setattr(launcher, "build_url", lambda p: f"http://127.0.0.1:{p}")
    monkeypatch.setattr(launcher, "_wait_for_server", lambda *a, **k: False)
    monkeypatch.setattr(launcher, "_start_server", lambda port: None)

    # Replace threading.Thread so no real thread is started
    class FakeThread:
        def __init__(self, **kw):
            pass

        def start(self):
            pass

    monkeypatch.setattr(launcher.threading, "Thread", FakeThread)

    # Stub webview so it's never called — if it IS called, that's a bug
    fake_webview = types.SimpleNamespace(
        create_window=lambda *a, **k: (_ for _ in ()).throw(
            AssertionError("webview.create_window should not be called")
        ),
        start=lambda *a, **k: (_ for _ in ()).throw(
            AssertionError("webview.start should not be called")
        ),
    )
    monkeypatch.setattr(launcher, "webview", fake_webview)

    with pytest.raises(SystemExit):
        launcher.main()


def test_main_proceeds_when_server_is_healthy(monkeypatch):
    """main() opens the window when the health check succeeds."""
    import config.app.launcher as launcher

    monkeypatch.setattr(launcher, "_build_bundle", lambda: None)
    monkeypatch.setattr(launcher, "select_port", lambda: 9999)
    monkeypatch.setattr(launcher, "build_url", lambda p: f"http://127.0.0.1:{p}")
    monkeypatch.setattr(launcher, "_wait_for_server", lambda *a, **k: True)
    monkeypatch.setattr(launcher, "_start_server", lambda port: None)

    class FakeThread:
        def __init__(self, **kw):
            pass

        def start(self):
            pass

    monkeypatch.setattr(launcher.threading, "Thread", FakeThread)

    window_created = []
    start_called = []

    fake_webview = types.SimpleNamespace(
        create_window=lambda *a, **k: window_created.append(True),
        start=lambda *a, **k: start_called.append(True),
    )
    monkeypatch.setattr(launcher, "webview", fake_webview)

    launcher.main()

    assert len(window_created) == 1, "webview.create_window should be called once"
    assert len(start_called) == 1, "webview.start should be called once"
