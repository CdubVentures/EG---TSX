"""
config_watcher.py — File change detection for EG Config Manager.

Polls config JSON files via os.stat mtime. When a file changes externally,
calls store.reload(key) which triggers subscriber callbacks.

Uses tkinter after() for non-blocking polling — no threads, no external deps.
"""

import tkinter as tk
from pathlib import Path

from .config_store import ConfigStore


class ConfigWatcher:
    """Polls config file mtimes to detect external edits."""

    def __init__(self, root: tk.Tk, store: ConfigStore,
                 interval_ms: int = 2000):
        self._root = root
        self._store = store
        self._interval = interval_ms
        self._pause_depth = 0
        self._paused = False
        self._mtimes: dict[str, float] = {}
        # Snapshot current mtimes
        for key, path in store._paths.items():
            self._mtimes[key] = self._mtime(path)
        self._poll()

    @staticmethod
    def _mtime(path: Path) -> float:
        try:
            return path.stat().st_mtime
        except (FileNotFoundError, OSError):
            return 0.0

    def _poll(self):
        if not self._paused:
            for key, path in self._store._paths.items():
                new_mt = self._mtime(path)
                if new_mt != self._mtimes.get(key, 0):
                    self._mtimes[key] = new_mt
                    # reload() compares content — no-op if data unchanged
                    self._store.reload(key)
        self._root.after(self._interval, self._poll)

    def pause(self):
        """Temporarily stop polling (e.g., during batch save). Supports nesting."""
        self._pause_depth += 1
        self._paused = True

    def resume(self):
        """Resume polling after pause, resnapshot all mtimes. Supports nesting."""
        self._pause_depth = max(0, self._pause_depth - 1)
        if self._pause_depth == 0:
            self._paused = False
            for key, path in self._store._paths.items():
                self._mtimes[key] = self._mtime(path)

    def snapshot(self):
        """Resnapshot all mtimes without resuming. Call after a save
        to prevent the watcher from detecting the write as external."""
        for key, path in self._store._paths.items():
            self._mtimes[key] = self._mtime(path)
